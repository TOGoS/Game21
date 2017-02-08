import Vector3D from './Vector3D';
import { addVector, scaleVector } from './vector3dmath';
import Quaternion from './Quaternion';
import KeyedList from './KeyedList';
import { LWSet } from './lwtypes';
import { deepFreeze } from './DeepFreezer';
import { EntityPath } from './simulationmessaging';
import {
	RoomVisualEntity,
	Entity,
	RoomLocation,
} from './world';
import { getEntitySubsystem, setEntitySubsystem } from './worldutil';
import {
	eachSubEntity
} from './worldutil';
import GameDataManager from './GameDataManager';
import SceneShader, { ShadeRaster, VISIBILITY_VOID, VISIBILITY_NONE, VISIBILITY_MIN } from './SceneShader';
import { ESSKEY_VISION, ESSCR_VISION, Vision } from './EntitySubsystem';
import EntitySystemBusMessage from './EntitySystemBusMessage';
import { ProgramExpression as EntitySubsystemProgramExpression } from './internalsystemprogram';
import SimulationState from './Maze1SimulationState';
import SimulationUpdate from './Maze1SimulationUpdate';
import ViewScene from './Maze1ViewScene';

function roomToMazeViewage( roomRef:string, roomPosition:Vector3D, gdm:GameDataManager, viewage:ViewScene, visibility:ShadeRaster, includeGreatInfo:boolean ):void {
	const room = gdm.getRoom(roomRef);
	if( room == null ) throw new Error("Failed to load room "+roomRef);
	
	let _entityToMazeViewage = ( position:Vector3D, orientation:Quaternion, entity:Entity ) => {}
	_entityToMazeViewage = ( position:Vector3D, orientation:Quaternion, entity:Entity ) => {
		const entityClass = gdm.getEntityClass(entity.classRef);
		if( entityClass == null ) throw new Error("Failed to load entity class "+entity.classRef);
		if( entityClass.visualRef ) {
			const minVrX = Math.max(0                , Math.floor((position.x+entityClass.visualBoundingBox.minX+visibility.originX)*visibility.resolution));
			const minVrY = Math.max(0                , Math.floor((position.y+entityClass.visualBoundingBox.minY+visibility.originY)*visibility.resolution));
			const maxVrX = Math.min(visibility.width , Math.ceil( (position.x+entityClass.visualBoundingBox.maxX+visibility.originX)*visibility.resolution));
			const maxVrY = Math.min(visibility.height, Math.ceil( (position.y+entityClass.visualBoundingBox.maxY+visibility.originY)*visibility.resolution));
			//console.log("Visibility bounds: "+minVrX+","+minVrY+" - "+maxVrX+","+maxVrY);
			let visible = false;
			isVisibleLoop: for( let vry=minVrY; vry<maxVrY; ++vry ) for( let vrx=minVrX; vrx<maxVrX; ++vrx ) {
				//console.log("Check bisibility raster@"+vrx+","+vry+"; "+(visibility.width*vry+vrx)+" = "+visibility.data[visibility.width*vry+vrx]);
				if( visibility.data[visibility.width*vry+vrx] >= VISIBILITY_MIN ) {
					visible = true;
					break isVisibleLoop;
				}
			}
			
			// TODO: Re-use items, visuals
			if( visible ) viewage.visualEntities.push( {
				position,
				orientation: orientation,
				visualRef: entityClass.visualRef,
				state: entity.state,
				animationStartTime: entity.animationStartTime,
				entity: includeGreatInfo ? entity : undefined,
			})
		}
		eachSubEntity( position, orientation, entity, gdm, _entityToMazeViewage );
	};

	for( let re in room.roomEntities ) {
		const roomEntity = room.roomEntities[re];
		const orientation = roomEntity.orientation ? roomEntity.orientation : Quaternion.IDENTITY;
		_entityToMazeViewage( addVector(roomPosition, roomEntity.position), orientation, roomEntity.entity );
	}
}

function sceneToMazeViewage( roomRef:string, roomPosition:Vector3D, gdm:GameDataManager, viewage:ViewScene, visibility:ShadeRaster, includeGreatInfo:boolean ):void {
	const room = gdm.getRoom(roomRef);
	if( room == null ) throw new Error("Failed to load room "+roomRef);
	roomToMazeViewage( roomRef, roomPosition, gdm, viewage, visibility, includeGreatInfo );
	for( let n in room.neighbors ) {
		const neighb = room.neighbors[n];
		roomToMazeViewage( neighb.roomRef, addVector(roomPosition, neighb.offset), gdm, viewage, visibility, includeGreatInfo );
	}
}

export default class VisionUpdate extends SimulationUpdate {
	protected vize(
		viewerEntityPath:EntityPath, viewerPosition:Vector3D, viewerEntity:Entity,
		visionSubsystemKey:string, visionSubsystem:Vision,
		busMessageQueue:EntitySystemBusMessage[]
	):Entity|null {
		//console.log("Maybze vizing "+viewerEntityPath[1]+"...");
		
		if( visionSubsystem.sceneExpressionRef == undefined ) return viewerEntity;
		
		//console.log("Definitely vizing "+viewerEntityPath[1]+"...");
				
		const newViewage:ViewScene = { visualEntities: [], worldTime: this.newTime };
		
		const viewerRoomRef = viewerEntityPath[0];
		
		const rasterWidth = 41;
		const rasterHeight = 31;
		const rasterResolution = 2;
		const distance = visionSubsystem.maxViewDistance;
		// Line up raster origin so it falls as close as possible to the center of the raster
		// while lining up edges with world coordinates
		// TODO: shouldn't need to snap to integer world coords; raster coords would be fine.
		const rasterOriginX = Math.floor(rasterWidth /rasterResolution/2) + viewerPosition.x - Math.floor(viewerPosition.x);
		const rasterOriginY = Math.floor(rasterHeight/rasterResolution/2) + viewerPosition.y - Math.floor(viewerPosition.y);
		const visibilityRaster   = new ShadeRaster(rasterWidth, rasterHeight, rasterResolution, rasterOriginX, rasterOriginY);
		let opacityRaster:ShadeRaster|undefined;
		const seeAll = !!visionSubsystem.isOmniscient && (
			visionSubsystem.scanMode == undefined || visionSubsystem.scanMode == "all");
		
		const visibilityDistanceInRasterPixels = rasterResolution*distance;
		opacityRaster = new ShadeRaster(rasterWidth, rasterHeight, rasterResolution, rasterOriginX, rasterOriginY);
		const sceneShader = new SceneShader(this.simulator.gameDataManager);
		sceneShader.sceneOpacityRaster(viewerRoomRef, scaleVector(viewerPosition, -1), opacityRaster);
		if( seeAll ) {
			sceneShader.initializeVisibilityRaster(opacityRaster, visibilityRaster, VISIBILITY_MIN);
		} else {
			sceneShader.initializeVisibilityRaster(opacityRaster, visibilityRaster);
			for( let ep in visionSubsystem.eyePositions ) {
				const eyePos = visionSubsystem.eyePositions[ep];
				sceneShader.opacityTolVisibilityRaster(opacityRaster,
					(rasterOriginX+eyePos.x)*rasterResolution,
					(rasterOriginY+eyePos.y)*rasterResolution,
					visibilityDistanceInRasterPixels, visibilityRaster);
			}
			sceneShader.growVisibility(visibilityRaster);
		}
		sceneToMazeViewage( viewerRoomRef, scaleVector(viewerPosition, -1), this.simulator.gameDataManager, newViewage, visibilityRaster, seeAll );
		if( seeAll ) newViewage.viewerLocation = {
			roomRef: viewerRoomRef,
			position: viewerPosition
		};

		newViewage.visibility = visibilityRaster;
		newViewage.opacity = opacityRaster;

		newViewage.viewerState = deepFreeze(viewerEntity);
		
		if( seeAll ) {
			newViewage.simulationState = this.initialSimulationState;
		}
		
		const sceneExpression = this.gameDataManager.getObject<EntitySubsystemProgramExpression>(visionSubsystem.sceneExpressionRef);
		
		return this.runSubsystemProgramEtc(viewerEntityPath, viewerEntity, visionSubsystemKey, sceneExpression, busMessageQueue, {
			"viewScene": newViewage
		});
		
		// TODO: set last update time on the subsystem, etc.
	}
	
	public doUpdate():Promise<SimulationState> {
		//console.log("Visible update room set", this.initialSimulationState.visiblyUpdatedRoomIdSet);
		return this.fullyLoadRoomsAndImmediateNeighbors(this.initialSimulationState.visiblyUpdatedRoomIdSet || {}).then( (roomIdSet) => {
			for( let r in roomIdSet ) {
				const room = this.getRoom(r);
				for( let re in room.roomEntities ) {
					const roomEntity = room.roomEntities[re];
					const visionSubsystemKey = ESSKEY_VISION;
					const visionSubsystem = getEntitySubsystem(roomEntity.entity, visionSubsystemKey, this.gameDataManager);
					if( visionSubsystem && visionSubsystem.classRef == ESSCR_VISION && visionSubsystem.isEnabled ) {
						const busMessages:EntitySystemBusMessage[] = [];
						const entityPath = [r,re];
						let entity = roomEntity.entity;
						this.doEntitySubsystemUpdate( entityPath, entity, (entity:Entity, busMessages:EntitySystemBusMessage[]) => {
							return this.vize(entityPath, roomEntity.position, entity, visionSubsystemKey, visionSubsystem, busMessages);
						});
						this.replaceEntity(entityPath, entity, roomEntity.entity);
					}
				}
			}
			this.newVisiblyUpdatedRoomIdSet = {}; // We have applied all the updates to the viewages!
			return this.makeNewState();
		});
	}
}
