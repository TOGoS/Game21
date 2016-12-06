/// <reference path="../Map.d.ts"/>

import KeyedList from './KeyedList';
import Vector3D from './Vector3D';
import { ZERO_VECTOR } from './vector3ds';
import { vectorsAreEqual, vectorsAreOpposite } from './vector3ds';
import { subtractVector, addVector, vectorLength } from './vector3dmath';
import Quaternion from './Quaternion';
import TransformationMatrix3D from './TransformationMatrix3D';
import { resolvedPromise } from './promises';
import { deepFreeze } from './DeepFreezer';

import { ESSCR_CONDUCTOR_NETWORK, ConductorNetwork } from './EntitySubsystem';
import { ConductorNetworkBuilder, ConductorEndpoint } from './conductornetworks';

import { Entity, EntityClass } from './world';
import { fetchEntitySubsystems, eachSubEntity } from './worldutil';
import GameDataManager from './GameDataManager';

export interface Placed<X> {
	position : Vector3D;
	orientation : Quaternion;
	item : X;
}

export interface WorldConductorNetworkEndpoints {
	network : ConductorNetwork;
	endpoints : ConductorEndpoint[];
}

export class EntityConductorNetworkCache
{
	public constructor(protected gameDataManager:GameDataManager) { }
	
	protected entityClassNetworkPromiseCache = new Map<string,Promise<ConductorNetwork>>();
	
	public fetchEntityClassConductorNetwork( classRef:string ):Promise<ConductorNetwork> {
		const cachedNetworkPromise = this.entityClassNetworkPromiseCache.get(classRef);
		if( cachedNetworkPromise ) return cachedNetworkPromise;
		
		const networkPromise = this.fetchEntityConductorNetworks({classRef}).then( (placedNetworks) => {
			const builder = new ConductorNetworkBuilder();
			for( let pn in placedNetworks ) {
				const placedNetwork:Placed<ConductorNetwork> = placedNetworks[pn];
				const xf = TransformationMatrix3D.multiply(
					TransformationMatrix3D.translation(placedNetwork.position),
					TransformationMatrix3D.fromQuaternion(placedNetwork.orientation)
				);
				builder.addNetwork(xf, placedNetwork.item);
			}
			return deepFreeze(builder.network);
		});
		this.entityClassNetworkPromiseCache.set(classRef, networkPromise);
		return networkPromise;
	}
	
	public fetchEntityConductorNetworks( entity:Entity ):Promise<Placed<ConductorNetwork>[]> {
		const subNetworkPromises:Promise<Placed<ConductorNetwork>>[] = [];
		return fetchEntitySubsystems(entity, this.gameDataManager).then( (subsystems) => {
			for( let ssk in subsystems ) {
				const subsystem = subsystems[ssk];
				if( subsystem.classRef == ESSCR_CONDUCTOR_NETWORK ) subNetworkPromises.push(Promise.resolve({
					position: ZERO_VECTOR,
					orientation: Quaternion.IDENTITY,
					item: subsystem
				}));
			}
			
			return this.gameDataManager.fetchObject<EntityClass>(entity.classRef);
		}).then( () => {
			eachSubEntity(
				ZERO_VECTOR, Quaternion.IDENTITY, entity, this.gameDataManager,
				(pos:Vector3D, ori:Quaternion, subEnt:Entity) => {
					subNetworkPromises.push( this.fetchEntityConductorNetwork(subEnt).then( (cn) => {
						return <Placed<ConductorNetwork>>{
							position: pos,
							orientation: ori,
							item: cn
						};
					}))
				}
			);
			
			return Promise.all(subNetworkPromises);
		});
	}
	
	public fetchEntityConductorNetwork( entity:Entity ):Promise<ConductorNetwork> {
		if( entity.subsystems ) {
			// Need to make sure they're not overriding any of the defaults
			for( let ssk in entity.subsystems ) {
				const ss = entity.subsystems[ssk];
				if( ss == null || ss.classRef == ESSCR_CONDUCTOR_NETWORK ) {
					// Might be overriding...
					throw new Error("Entity instance overrides of conductor networks not yet supported");
				}
			}
		}
		return this.fetchEntityClassConductorNetwork( entity.classRef );
	}
}

/*
function getEntityClassConductorEndpoints(
	gdm:GameDataManager, classRef:string, startPos:Vector3D, startDir:Vector3D, into:Placed<WorldConductorNetworkEndpoints>[]=[]
):Placed<WorldConductorNetworkEndpoints>[] {
	// TODO: cache result base on hard reference to class
	
	const entityClass = gdm.getEntityClass(classRef);
	if( entityClass.defaultSubsystems ) {
		
	}
	const bb = 
}
*/

/*
export function getWorldConductorEndpoints( gdm:GameDataManager, roomId:string, pos:Vector3D, dir:Vector3D ):Placed<ConductorNetwork>[] {
	const room = gdm.getRoom(roomId);
	const networkBuilder = new ConductorNetworkBuilder();
	for( let re in room.roomEntities ) {
		const roomEntity = room.roomEntities[re];
		let hasCustomConductorNetworks = false;
		if( roomEntity.entity.subsystems ) for( let ssk in roomEntity.entity.subsystems ) {
			const ss = roomEntity.entity.subsystems[ssk];
			if( ss == null ) {
				// TODO: Only if the thing overridden
				// was a conductor network
			} else if( ss.classRef == ESSCR_CONDUCTOR_NETWORK ) {
				hasCustomConductorNetworks = true;
			}
		}
		if( hasCustomConductorNetworks ) {
			throw new Error('Oh no, entity has custom conductor networks.');
		}
		// TODO:
	}
	throw new Error("This doesn't work yet");
}
*/

/*
export function findConductorEndpointsFromWorldPosition( gdm:GameDataManager, roomId:string, pos:Vector3D, direction:Vector3D ) {
	const networks = getWorldConductorNetworks(gdm, roomId, pos, direction);
}
*/
