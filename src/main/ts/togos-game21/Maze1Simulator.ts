import KeyedList from './KeyedList';
import Vector3D from './Vector3D';
import { makeVector, setVector, vectorToString, parseVector, ZERO_VECTOR } from './vector3ds';
import AABB from './AABB';
import {
	makeAabb, aabbWidth,
	aabbContainsVector, aabbIntersectsWithOffset,
	ZERO_AABB,
} from './aabbs';
import {
	Room,
	RoomEntity,
	RoomLocation,
	RoomVisualEntity,
	Entity,
	EntityClass,
	TileTree,
	TileEntity,
	StructureType,
	TileEntityPalette,
} from './world';
import EntitySubsystem, {
	Appendage,
	Button,
	SimpleComputer,
	ESSKEY_PROXIMALEVENTDETECTOR,
} from './EntitySubsystem';
import {
	eachSubEntityIntersectingBb,
	connectRooms,
	setEntitySubsystem,
	getEntitySubsystems,
	getEntitySubsystem,
} from './worldutil';
import {
	rewriteTileTreeIntersecting
} from './tiletrees';
import {
	ProximalSimulationMessage,
} from './SimulationMessage';
import {
	EntityPath,
	ModifyEntityAction,
	SimulationAction,
	SendDataPacketAction,
	SendAnalogValueAction,
	ReceiveMessageAction,
	ROOMID_SIMULATOR,
	ROOMID_FINDENTITY,
	ROOMID_EXTERNAL,
	AT_STRUCTURE_OFFSET,
} from './simulationmessaging';
import {
	accumulateVector, addVector, subtractVector, scaleVector, normalizeVector,
	vectorLength, vectorIsZero, dotProduct, roundVectorToGrid
} from './vector3dmath';
import * as dat from './maze1demodata';
import EntitySystemBusMessage from './EntitySystemBusMessage';
import * as esp from './internalsystemprogram';
import Logger from './Logger';
import GameDataManager from './GameDataManager';
import newUuidRef from './newUuidRef';
import { pickOne } from './graphmaze/picking';
import { thaw } from './DeepFreezer';

enum XYZDirection {
	NONE = 0x00,
	POSITIVE_X = 0x1,
	NEGATIVE_X = 0x2,
	POSITIVE_Y = 0x4,
	NEGATIVE_Y = 0x8,
	POSITIVE_X_POSITIVE_Y = 0x5,
	NEGATIVE_X_NEGATIVE_Y = 0xA,
	NEGATIVE_X_POSITIVE_Y = 0x6,
	POSITIVE_X_NEGATIVE_Y = 0x9,
	// Fill these in as needed
	POSITIVE_Z = 0x10,
	NEGATIVE_Z = 0x20,
};

const xyzDirectionVectors:KeyedList<Vector3D> = {};
{
	// encode component
	const ec = function(i:number):number {
		return i == 0 ? 0 : i > 0 ? 1 : 2;
	}
	
	for( let z=-1; z<=1; ++z ) {
		for( let y=-1; y<=1; ++y ) {
			for( let x=-1; x<=1; ++x ) {
				const xyzDirection = (ec(x)) | (ec(y)<<2) | (ec(z)<<4);
				xyzDirectionVectors[xyzDirection] = xyzDirection == 0 ? ZERO_VECTOR : makeVector(x,y,z);
			}
		}
	}
}
const sideDirections:XYZDirection[] = [
	XYZDirection.POSITIVE_X,
	XYZDirection.POSITIVE_Y,
	XYZDirection.POSITIVE_Z,
	XYZDirection.NEGATIVE_X,
	XYZDirection.NEGATIVE_Y,
	XYZDirection.NEGATIVE_Z,
];
const ALL_SIDES = 0x3F;

interface RoomEntityUpdate {
	destroyed? : boolean;
	roomRef? : string;
	position? : Vector3D;
	velocityPosition? : Vector3D;
	velocity? : Vector3D;
	desiredMovementDirection? : Vector3D;
	subsystems? : KeyedList<EntitySubsystem>;
}

/*
 * Return values:
 *   true = yes, include this!
 *   false = I do not care about this at all!
 *   undefined = I don't care about this specific thing, but I may care about things contained in it
 */
type EntityFilter = (roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass)=>boolean|undefined; 

interface FoundEntity {
	entityPath : EntityPath;
	
	roomRef : string;
	roomEntityId : string;
	roomEntity : RoomEntity;
	
	// Individual entity that was collided-with
	entity : Entity;
	entityPosition : Vector3D;
	entityClass : EntityClass; // since we have it anyway!
}

type BounceBox = { [k:number]: FoundEntity|undefined }

const entityPositionBuffer:Vector3D = makeVector(0,0,0);

function entityVelocity( roomEntity:RoomEntity ):Vector3D {
	return roomEntity.velocity || ZERO_VECTOR;
}
function entityMass( entityClass:EntityClass ):number {
	return entityClass.mass == null ? Infinity : entityClass.mass;
}

function bounceFactor( ec0:EntityClass, ec1:EntityClass ):number {
	const bf0 = ec0.bounciness == null ? 0.5 : ec0.bounciness;
	const bf1 = ec1.bounciness == null ? 0.5 : ec1.bounciness;
	return bf0*bf1;
}

function oneify( val:number ):number {
	return val == 0 ? 0 : val > 0 ? 1 : -1;
}

function clampAbs( val:number, maxAbs:number ):number {
	if( val > maxAbs  ) return maxAbs;
	if( val < -maxAbs ) return -maxAbs;
	return val;
}

function directionate( dir:number, current:number ):number {
	if( dir > 0 && current > 0 ) return current;
	if( dir < 0 && current < 0 ) return current;
	return current;
}

function directionateVector( desired:Vector3D, current:Vector3D ):Vector3D {
	return {
		x: directionate(desired.x, current.x),
		y: directionate(desired.y, current.y),
		z: directionate(desired.z, current.z),
	}
}

/**
 * Calculate the impulse that entity A should exert onto entity B
 * in order to affect the desired change in B's relative velocity, dv.
 */
function dvImpulse(
	desiredDv:Vector3D, entityAMass:number|undefined, entityBMass:number|undefined,
	maxImpulseMagnitude:number, multiplier:number=1
):Vector3D {
	if( entityAMass == null ) entityAMass = Infinity;
	if( entityBMass == null ) entityBMass = Infinity;
	const minMass = Math.min(entityAMass, entityBMass);
	if( minMass == Infinity ) {
		// maximum impulse!
		return normalizeVector(desiredDv, maxImpulseMagnitude*multiplier);
	}
	const desiredImpulse = scaleVector(desiredDv, minMass);
	const desiredImpulseMagnitude = vectorLength(desiredImpulse);
	if( desiredImpulseMagnitude > maxImpulseMagnitude ) {
		multiplier *= maxImpulseMagnitude / desiredImpulseMagnitude;
	}
	return scaleVector(desiredImpulse, multiplier);
}

function impulseForAtLeastDesiredVelocity(
	desiredRelativeVelocity:Vector3D,
	currentRelativeVelocity:Vector3D,
	entityAMass:number|undefined, entityBMass:number|undefined,
	maxSpeed:number, maxImpulse:number,
	multiplier:number=1
):Vector3D {
	const targetRelativeVelocity = normalizeVector(desiredRelativeVelocity, maxSpeed);
	const targetDeltaVelocity = directionateVector(
		desiredRelativeVelocity,
		subtractVector(targetRelativeVelocity, currentRelativeVelocity)
	);
	return dvImpulse( targetDeltaVelocity, entityAMass, entityBMass, maxImpulse, multiplier );
}

interface Collision {
	roomAId : string;
	roomEntityA : RoomEntity;
	roomBId : string;
	roomEntityB : RoomEntity;
	velocity : Vector3D;
}

function perpendicularPart( vec:Vector3D, perpendicularTo:Vector3D ):Vector3D {
	const perpendicularLength = vectorLength(perpendicularTo);
	if( perpendicularLength == 0 ) return vec;
	return subtractVector(vec, scaleVector(perpendicularTo, dotProduct(vec,perpendicularTo)/perpendicularLength));
}

import {
	HardRef, SoftRef, LWSet
} from './lwtypes';

type RoomID = SoftRef;

/**
 * Represents the state of the simulator between steps.
 */
export interface SimulationState {
	time : number;
	enqueuedActions : SimulationAction[];
	/**
	 * IDs of rooms that with potentially physically active things.
	 * This does not need to include neighboring rooms,
	 * though they will also need to be loaded before doing the physics update.
	 * The physics update step will do the physics update and then
	 * rewrite this set.  All other steps will only add to it.
	 */
	physicallyActiveRoomIdSet : LWSet<RoomID>;
	/**
	 * Start point when searching for entities.
	 */
	rootRoomIdSet : LWSet<RoomID>;
}

export interface HardSimulationState extends SimulationState {
	dataRef : HardRef;
}

type EntityMatchFunction = (path:EntityPath,e:Entity)=>boolean;

export abstract class SimulationUpdate {
	protected gameDataManager:GameDataManager;
	protected newEnqueuedActions:SimulationAction[];
	protected newPhysicallyActiveRoomIdSet : LWSet<RoomID>;
	protected logger:Logger;
	protected newTime:number;
	
	/**
	 * Each step should simulate as if 'simulated step time' is passing.
	 * Logical step end time is the value that should be put into the
	 * resulting simulation state's #time field.
	 * 
	 * Defaults are appropriate for logically instantaneous updates
	 * that don't care about time.
	 */
	public constructor(
		protected simulator:Maze1Simulator,
		protected initialSimulationState:SimulationState,
	) {
		this.gameDataManager = simulator.gameDataManager;
		this.logger = simulator.logger;
		// By default, don't change much.
		// Different updates can rewrite these in doUpdate() before calling makeNewState()
		this.newEnqueuedActions = this.initialSimulationState.enqueuedActions;
		this.newPhysicallyActiveRoomIdSet = this.initialSimulationState.physicallyActiveRoomIdSet;
		this.newTime = this.initialSimulationState.time;
	}
	
	protected markRoomPhysicallyActive(roomId:RoomID):void {
		this.newPhysicallyActiveRoomIdSet[roomId] = true;
	}
	
	protected enqueueAction( act:SimulationAction ):void {
		this.newEnqueuedActions.push(act);
	}
	
	protected getMutableRoom( roomId:string ):Room {
		return this.gameDataManager.getMutableRoom(roomId);
	}
	
	public getRoom( roomId:string ):Room {
		return this.gameDataManager.getRoom(roomId);
	}
	
	public fullyCacheRoom( roomId:string ):Promise<Room> {
		return this.gameDataManager.fullyCacheRoom(roomId);
	}
	
	public fullyLoadRoom( roomId:string ):Promise<Room> {
		return this.fullyCacheRoom(roomId).then( (room) => {
			return this.getMutableRoom(roomId);
		});
	}
	
	protected fullyLoadRooms2( rootRoomId:string, roomLoadPromises:KeyedList<Promise<Room>> ):Promise<Room> {
		if( roomLoadPromises[rootRoomId] ) return roomLoadPromises[rootRoomId];
		
		roomLoadPromises[rootRoomId] = this.fullyLoadRoom( rootRoomId );
		return roomLoadPromises[rootRoomId].then( (room) => {
			const lProms:Promise<Room>[] = [];
			for( let n in room.neighbors ) {
				const nRoomRef = room.neighbors[n].roomRef;
				if( !roomLoadPromises[nRoomRef] ) {
					lProms.push(this.fullyLoadRooms2(nRoomRef, roomLoadPromises));
				}
			}
			return Promise.all(lProms).then( () => room );
		});
	}
	
	public fullyLoadRooms( rootRoomId:string, roomLoadPromises:KeyedList<Promise<Room>>={} ):Promise<void> {
		return this.fullyLoadRooms2(rootRoomId, roomLoadPromises).then( () => {} );
	}
	
	protected fullyLoadImmediateNeighbors( room:Room, loadPromises:KeyedList<Promise<Room>> ):Promise<any> {
		const newPromises:Promise<Room>[] = [];
		if( room.neighbors ) for( let n in room.neighbors ) {
			const nrRef = room.neighbors[n].roomRef;
			if( !loadPromises[nrRef] ) {
				newPromises.push(loadPromises[nrRef] = this.fullyCacheRoom(nrRef));
			}
		}
		return Promise.all(newPromises);
	}
	
	public fullyLoadRoomsAndImmediateNeighbors( roomIds:LWSet<RoomID> ):Promise<void> {
		const allPromises:KeyedList<Promise<Room>> = {};
		const newPromises:Promise<Room>[] = [];
		for( let r in roomIds ) {
			if( !allPromises[r] ) {
				// Due to the nature of primises,
				// allPromises will first be filled with fully load room + neighbor promises,
				// then the remaining neighbor ones.
				const p = this.fullyLoadRoom(r).then( (room) => this.fullyLoadImmediateNeighbors(room, allPromises) );
				newPromises.push(allPromises[r] = p);
			}
		}
		return Promise.all(newPromises).then( () => {} );
	}
	
	public fixLocation(loc:RoomLocation):RoomLocation {
		let room = this.getMutableRoom(loc.roomRef);
		if( !aabbContainsVector(room.bounds, loc.position) ) for( let n in room.neighbors ) {
			const neighb = room.neighbors[n];
			const fixedPos = subtractVector(loc.position, neighb.offset);
			if( aabbContainsVector(neighb.bounds, fixedPos) ) {
				return {
					roomRef: neighb.roomRef,
					position: fixedPos,
				};
			}
		}
		return loc;
	}
	
	protected roomEntityIsPhysicallyActive( roomEntity:RoomEntity ) {
		if( roomEntity.entity.desiredMovementDirection ) return true;
		if( roomEntity.velocity && !vectorIsZero(roomEntity.velocity) ) return true;
		const entityClass = this.gameDataManager.getEntityClass(roomEntity.entity.classRef);
		if( entityClass.isAffectedByGravity ) return true;
		return false;
	}
	
	public updateRoomEntity( roomRef:string, entityId:string, update:RoomEntityUpdate ):void {
		let room : Room = this.getMutableRoom(roomRef);
		let roomEntity = room.roomEntities[entityId];
		if( update.destroyed ) {
			delete room.roomEntities[entityId];
			return;
		}
		if( update.velocity ) {
			roomEntity.velocity = update.velocity;
		}
		if( update.position ) {
			roomEntity.position = update.position;
			delete roomEntity.velocityPosition;
		}
		if( update.desiredMovementDirection ) {
			roomEntity.entity.desiredMovementDirection = update.desiredMovementDirection;
		}
		if( update.subsystems ) {
			for( let k in update.subsystems ) {
				roomEntity.entity = setEntitySubsystem(roomEntity.entity, k, update.subsystems[k], this.gameDataManager);
			}
		}
		if( update.velocityPosition ) roomEntity.velocityPosition = update.velocityPosition;
		let newRoomRef = roomRef;
		if( update.roomRef != null && update.roomRef != roomRef ) {
			newRoomRef = update.roomRef;
			let newRoom : Room = this.getMutableRoom(update.roomRef);
			newRoom.roomEntities[entityId] = roomEntity;
			delete room.roomEntities[entityId];
		}
		// TODO: Here's the spot where we could just totally stop simulating
		// if the entity happened to be settled.
		if( !this.newPhysicallyActiveRoomIdSet[newRoomRef] && this.roomEntityIsPhysicallyActive(roomEntity) ) {
			this.newPhysicallyActiveRoomIdSet[newRoomRef] = true;
		} 
	}
	
	/**
	 * It should be safe to pass entityPositionBuffer as the entity position,
	 * since checking intersections is the last thing done with it.
	 */
	protected entitiesAt3(
		entityPath:EntityPath, roomEntity:RoomEntity, // Root roomEntity
		entityPos:Vector3D, entity:Entity, // Individual entity being checked against (may be a sub-entity of the roomEntity)
		checkPos:Vector3D, checkBb:AABB, // Sample box
		filter:EntityFilter,
		into:FoundEntity[]
	):void {
		const proto = this.gameDataManager.getEntityClass( entity.classRef );
		const filtered = filter(entityPath[1], roomEntity, entity, proto)
		if( filtered === false ) return;
		if( !aabbIntersectsWithOffset(entityPos, proto.physicalBoundingBox, checkPos, checkBb) ) return;
		
		if( proto.structureType == StructureType.INDIVIDUAL ) {
			if( !filtered ) return;
			into.push( {
				entityPath,
				roomRef: entityPath[0],
				roomEntityId: entityPath[1],
				roomEntity: roomEntity,
				entityPosition: {x:entityPos.x, y:entityPos.y, z:entityPos.z},
				entity: entity,
				entityClass: proto,
			} );
		}
		
		// Position buffer gets re-used, so we can't rely on it
		// still having the outer entity's position when we're
		// inside the callback
		const posX = entityPos.x, posY = entityPos.y, posZ = entityPos.z;
		eachSubEntityIntersectingBb( entity, entityPos, checkPos, checkBb, this.gameDataManager, (subEnt, subEntPos, ori) => {
			const subPath = entityPath.concat([
				AT_STRUCTURE_OFFSET,
				(subEntPos.x-posX)+","+(subEntPos.y-posY)+","+(subEntPos.z-posZ)
			]);
			this.entitiesAt3( subPath, roomEntity, subEntPos, subEnt, checkPos, checkBb, filter, into );
		}, this, entityPositionBuffer);
	}
	
	protected entitiesAt2( roomPos:Vector3D, roomRef:string, checkPos:Vector3D, checkBb:AABB, filter:EntityFilter, into:FoundEntity[] ):void {
		// Room bounds have presumably already been determined to intersect
		// with that of the box being checked, so we'll skip that and go
		// straight to checking entities.
		const room:Room = this.getRoom(roomRef);
		for( let re in room.roomEntities ) {
			const roomEntity = room.roomEntities[re];
			addVector( roomPos, roomEntity.position, entityPositionBuffer );
			this.entitiesAt3([roomRef, re], roomEntity, entityPositionBuffer, roomEntity.entity, checkPos, checkBb, filter, into)
		}
	}
	
	/** Overly simplistic 'is there anything at this exact point' check */
	public entitiesAt( roomRef:string, pos:Vector3D, bb:AABB, filter:EntityFilter ):FoundEntity[] {
		const collisions:FoundEntity[] = [];
		const room = this.getRoom(roomRef);
		if( aabbIntersectsWithOffset(ZERO_VECTOR, room.bounds, pos, bb) ) {
			this.entitiesAt2( ZERO_VECTOR, roomRef, pos, bb, filter, collisions );
		}
		for( let n in room.neighbors ) {
			const neighb = room.neighbors[n];
			// I used to check that bb overlapped neighb.bounds.
			// That results in missing collisions with entities whose physical bounds
			// go beyond that of the room they're in, duh.	
			this.entitiesAt2( neighb.offset, neighb.roomRef, pos, bb, filter, collisions );
		}
		return collisions;
	}
	
	protected setTileTreeBlock( roomId:string, pos:Vector3D, tileScale:number, newTile:TileEntity|number|string|null ):void {
		const room = this.getMutableRoom(roomId);
		for( let re in room.roomEntities ) {
			const roomEntity = room.roomEntities[re];
			const entityClass = this.gameDataManager.getEntityClass(roomEntity.entity.classRef);
			if( entityClass.structureType == StructureType.TILE_TREE ) {
				const posWithinTt = subtractVector(pos, roomEntity.position);
				if( aabbContainsVector(entityClass.tilingBoundingBox, posWithinTt) ) {
					// TODO: Make sure this works for trees with depth > 1
					roomEntity.entity.classRef = rewriteTileTreeIntersecting(
						roomEntity.position, roomEntity.entity.classRef,
						pos, ZERO_AABB,
						(ckPos:Vector3D, ckAabb:AABB, currentTileIndex:number, currentTileEntity:TileEntity|null|undefined) => {
							if( aabbWidth(ckAabb) == tileScale ) {
								return newTile;
							} else {
								// TODO: recurse, I guess?
								return currentTileIndex;
							}
						}, this.gameDataManager
					);
				}
			}
		}
	}
	
	/** @temporary-shortcut */
	public destroyCheapDoor( roomId:string, pos:Vector3D, doorEntityClass:string ) {
		// destroy all nearby doorEntityClass tiles in the same root tiletree
		const aabbOfDestruction = makeAabb(pos.x-0.5, pos.y-2.5, pos.z-0.5, pos.x+0.5, pos.y+2.5, pos.z+0.5);
		const room = this.getMutableRoom(roomId);
		for( let re in room.roomEntities ) {
			const roomEntity = room.roomEntities[re];
			const entityClass = this.gameDataManager.getEntityClass(roomEntity.entity.classRef);
			if( entityClass.structureType == StructureType.TILE_TREE ) {
				const posWithinTt = subtractVector(pos, roomEntity.position);
				if( aabbContainsVector(entityClass.tilingBoundingBox, posWithinTt) ) {
					roomEntity.entity.classRef = rewriteTileTreeIntersecting(
						roomEntity.position, roomEntity.entity.classRef,
						ZERO_VECTOR, aabbOfDestruction,
						(ckPos:Vector3D, ckAabb:AABB, currentTileIndex:number, currentTileEntity:TileEntity|null|undefined) => {
							if(
								aabbIntersectsWithOffset(ckPos, ckAabb, ZERO_VECTOR, aabbOfDestruction) &&
								currentTileEntity && currentTileEntity.entity.classRef == doorEntityClass
							) {
								return null;
							} else {
								return currentTileIndex;
							}
						}, this.gameDataManager
					);
				}
			}
		}
		this.sendProximalEventMessageToNearbyEntities(roomId, pos, 8, {
			classRef: "http://ns.nuke24.net/Game21/SimulationMessage/SimpleEventOccurred",
			eventCode: 'door-opened'
		});
	}
	
	/**
	 * Returns true if the message was understood (even if not successful)
	 */
	protected processSpecialEntityCommand(
		entityPath:EntityPath, entity:Entity, md:EntitySystemBusMessage
	):boolean {
		entityPath = this.fixEntityPathRoomId(entityPath);
		const roomId = entityPath[0];
		
		// TODO: Replace all the following with subsystems
		// And remove this method!
		const path = md[0];
		if( path == "/desiredmovementdirection" ) {
			this.updateRoomEntity(entityPath[0], entityPath[1], {
				desiredMovementDirection: makeVector(+md[1],+md[2],+md[3])
			});
			return true;
		} else if( path == "/painttiletreeblock" ) {
			const relX = +md[1];
			const relY = +md[2];
			const relZ = +md[3];
			const tileScale = +md[4] || 1;
			const block = md[5];
			if( typeof block != 'string' && typeof block != 'number' && block !== null ) {
				console.log("Erps; bad block");
				return true;
			}
			if( typeof block == 'string' ) {
				if( this.gameDataManager.getObjectIfLoaded<EntityClass>( block ) == null ) {
					console.log("Entity class "+block+" not loaded.  Try again later.");
					// Try to load it up and ignore this request for now.
					// User can click again. :P
					this.gameDataManager.fetchObject<EntityClass>( block ).then( (entiyClass) => {
						console.log("Entity class "+block+" loaded, now!  You should be able to place it, now.");
					}).catch( (err) => {
						console.error("Failed to load entity class "+block);
					});
					return true;
				}
			}
			const roomEntity = this.getRoomEntityOrUndefined(entityPath);
			if( roomEntity == undefined ) {
				console.warn("Can't place tile near "+entityPath.join('/')+"; entity not found");
				return true;
			}
			const rePos = roomEntity.position;
			const blockLoc = this.fixLocation( {roomRef: roomId, position: makeVector(relX+rePos.x, relY+rePos.y, relZ+rePos.z)} );
			this.setTileTreeBlock( blockLoc.roomRef, blockLoc.position, tileScale, block );
			return true;
		} else if( path == '/give' ) {
			// put a thing in your inventory, if there's space
			const itemClassRef = md[1];
			if( itemClassRef == undefined ) return true;
			try {
				const itemClass = this.gameDataManager.getEntityClass(itemClassRef, true);
			} catch (err) {
				console.error("Couldn't give item", err);
				return true;
			}
			const entityClass = this.gameDataManager.getEntityClass(entity.classRef);
			const inventorySize = entityClass.maze1InventorySize || 0;
			if( inventorySize == 0 ) {
				console.warn("Can't add item; inventory size = 0");
				return true;
			}
			let currentItemCount = 0;
			if( entity.maze1Inventory == undefined ) entity.maze1Inventory = {};
			for( let k in entity.maze1Inventory ) ++currentItemCount;
			if( currentItemCount < inventorySize ) {
				entity.maze1Inventory[newUuidRef()] = {
					classRef: itemClassRef
				};
			} else {
				console.warn("Can't add item; inventory full");
			}
			return true;
		} else if( path == '/vomit' ) {
			if( entity.storedEnergy != undefined ) {
				const roomEntity = this.getRoomEntityOrUndefined(entityPath);
				if( roomEntity == undefined ) {
					console.warn("Can't vomit; room entity "+entityPath.join('/')+" not found");
					return true;
				}
				entity.storedEnergy /= 2;
				chunks: for( let i=0; i<20; ++i ) {
					let vel = roomEntity.velocity||ZERO_VECTOR;
					if( vectorIsZero(vel) ) vel = {x:0,y:-1,z:0};
					vel = addVector(vel, normalizeVector(vel, 5));
					vel = {x:vel.x+Math.random()-0.5, y:vel.y+Math.random()-0.5, z:vel.z};
					vel = normalizeVector(vel, 4 + Math.random()*0.25 - 0.125);
					const offset = normalizeVector(vel, 0.5);
					const chunk = {classRef: pickOne([dat.vomitChunk1EntityClassId, dat.vomitChunk2EntityClassId, dat.vomitChunk3EntityClassId])};
					try {
						this.placeItemSomewhereNear(chunk, roomId, addVector(roomEntity.position, offset), vel);
					} catch (err) { break chunks; }
				}
			}
			return true;
		} else if( path == '/throwinventoryitem' ) {
			const roomEntity = this.getRoomEntityOrUndefined(entityPath);
			if( roomEntity == undefined ) {
				console.warn("Can't throw; no roomEntity "+entityPath.join('/')+" found");
				return true;
			}
			if( md[1] == undefined ) {
				console.error("missing item key argument to /throwinventoryitem");
				return true;
			}
			const itemRef = md[1];
			if( entity.maze1Inventory == undefined ) {
				console.warn("No inventory at all; can't throw item'");
				return true;
			}
			const item = entity.maze1Inventory[itemRef];
			if( item == undefined ) {
				console.warn("No item "+itemRef+" seems to exist in inventory:", entity.maze1Inventory);
				return true;
			}
			const throwOffset = normalizeVector({x:+md[2], y:+md[3], z:+md[4]}, 0.5);
			try {
				this.placeItemSomewhereNear(item, roomId, addVector(roomEntity.position,throwOffset), scaleVector(throwOffset,10));
			} catch( err ) {
				console.log("Couldn't throw:", err)
				return true;
			}
			delete entity.maze1Inventory[itemRef];
			return true;
		} else {
			return false;
		}
	}
	
	protected processSimulatorCommand(messageData:EntitySystemBusMessage):void {
		switch( messageData[0] ) {
		case '/create-room':
			{
				const roomId = messageData[1];
				if( typeof roomId != 'string' ) {
					this.logger.error("'create-room' argument not a string", messageData);
					return;
				}
				const size = +(messageData[2] || 16);
				const ttId = newUuidRef();
				this.gameDataManager.putMutableObject<Room>(roomId, {
					bounds: makeAabb(-size/2,-size/2,-8, size/2,size/2,8),
					neighbors: {},
					roomEntities: {
						[ttId]: {
							position: ZERO_VECTOR,
							entity: {
								classRef: dat.getDefaultRoomTileTreeRef(this.gameDataManager, size, size, 1)
							}
						}
					}
				});
				this.logger.log("Created room "+roomId);
			}
			break;
		case '/connect-rooms':
			{
				const room1Id = messageData[1];
				const dir = ""+messageData[2];
				const room2Id = messageData[3];
				// For now all rooms are 16x16, so
				let nx = 0, ny = 0, nz = 0;
				for( let i=0; i<dir.length; ++i ) {
					switch( dir[i] ) {
					case 't': ny = -1; break;
					case 'b': ny = +1; break;
					case 'l': nx = -1; break;
					case 'r': nx = +1; break;
					case 'a': nz = -1; break;
					case 'z': nz = +1; break;
					default:
						this.logger.warn("Unrecognized direction char: "+dir[i]);
					}
				}
				try {
					const room1 = this.gameDataManager.getRoom(room1Id);
					const room2 = this.gameDataManager.getRoom(room2Id);
					const dx =
						nx > 0 ? room1.bounds.maxX-room2.bounds.minX :
						nx < 0 ? room1.bounds.minX-room2.bounds.maxX : 0;
					const dy =
						ny > 0 ? room1.bounds.maxY-room2.bounds.minY :
						ny < 0 ? room1.bounds.minY-room2.bounds.maxY : 0;
					const dz =
						nz > 0 ? room1.bounds.maxZ-room2.bounds.minZ :
						nz < 0 ? room1.bounds.minZ-room2.bounds.maxZ : 0;
					const nVec = makeVector(dx, dy, dz);
					this.logger.log("Connecting "+room1Id+" to "+room2Id+" @ "+vectorToString(nVec));
					connectRooms(this.gameDataManager, room1Id, room2Id, nVec);
				} catch( err ) {
					this.logger.error("Failed to connect rooms", err);
				}
			}
			break;
		default:
			this.logger.warn("Unrecognized simulator message:", messageData);
		}
	}
	
	protected get hasPendingMessageUpdates():boolean {
		return this.newEnqueuedActions.length > 0;
	}
	
	protected findEntityInAnyLoadedRoom(match:string|EntityMatchFunction, initialGuesses?:LWSet<RoomID>):EntityPath|undefined {
		if( initialGuesses == undefined ) initialGuesses = this.initialSimulationState.rootRoomIdSet;
		
		// Potentially optimize for the 'I know where that is!' case by
		// allowing initialGuesses to be a single roomID
		// and do a allocation-free check before going all out.
		// Goal is to check that room, then its neighbors, then the entire world.
		// May want to cache locations on the simulator.
		const guessList:RoomID[] = [];
		const guessSet:LWSet<RoomID> = {}
		
		for( let g in initialGuesses ) {
			guessList.push(g);
			guessSet[g] = true;
		}
		
		for( let i=0; i<guessList.length; ++i ) {
			const guess = guessList[i];
			const room = this.gameDataManager.getObjectIfLoaded<Room>(guess);
			if( room && room.roomEntities ) {
				if( typeof match == 'string' ) {
					if( room.roomEntities[match] ) return [guess,match];
				} else {
					for( let re in room.roomEntities ) {
						const roomEntity = room.roomEntities[re];
						const path = [guess,re];
						if( match(path, roomEntity.entity) ) return path;
					}
				}
			}
			
			if( room && room.neighbors ) for( let n in room.neighbors ) {
				const neighborRoomId = room.neighbors[n].roomRef;
				if( !guessSet[neighborRoomId] ) {
					// Add neighbor to the guess list!
					guessList.push(neighborRoomId);
					guessSet[neighborRoomId] = true;
				} 
			}
		}
		
		// TODO: Continue on with any other loaded rooms?
		
		return undefined;
	}
	
	/**
	 * Given an entity path, returns one where room ID is filled in,
	 * or throws an error if the identified entity couldn't be found anywhere.
	 */
	protected fixEntityPathRoomId(entityPath:EntityPath):EntityPath {
		if( entityPath[0] == ROOMID_FINDENTITY ) {
			const resolved = this.findEntityInAnyLoadedRoom(entityPath[1]);
			if( resolved == undefined ) throw new Error("Failed to resolve entity path "+entityPath.join('/'));
			return [resolved[0], ...entityPath.slice(1)];
		}
		return entityPath;
	}
	
	public getRoomEntityOrUndefined(entityPath:string|EntityPath):RoomEntity|undefined {
		if( typeof entityPath == 'string' ) {
			entityPath = [ROOMID_FINDENTITY, entityPath];
		}
		let roomId:string|undefined = entityPath[0];
		if( roomId == ROOMID_FINDENTITY ) {
			const path = this.findEntityInAnyLoadedRoom(entityPath[1]);
			if( path == undefined ) return undefined;
			roomId = path[0];
		}
		const room = this.gameDataManager.getRoom(roomId);
		return room.roomEntities[entityPath[1]];
	}
	
	public getRoomEntity(entityPath:string|EntityPath):RoomEntity {
		const e = this.getRoomEntityOrUndefined(entityPath);
		if( e == undefined ) throw new Error("Room entity "+entityPath+" not found");
		return e;
	}
	
	protected runSubsystemProgram(
		entityPath:EntityPath, entity:Entity, subsystemKey:string, program:esp.ProgramExpression,
		busMessageQueue:EntitySystemBusMessage[],
		variableValues:KeyedList<any>
	):any {
		const ctx:ISPEC = {
			entityPath, entity, subsystemKey, busMessageQueue, variableValues
		};
		return evalInternalSystemProgram( program, ctx );
	}
	
	protected deliverPoke(entityPath:EntityPath, entity:Entity) {
		const subsystems = getEntitySubsystems(entity, this.gameDataManager);
		for( let sk in subsystems ) {
			const subsystem = subsystems[sk];
			switch( subsystem.classRef ) {
			case "http://ns.nuke24.net/Game21/EntitySubsystem/Button":
				if( subsystem.pokedExpressionRef == undefined ) continue;
				const expr = this.gameDataManager.getObject<esp.ProgramExpression>(subsystem.pokedExpressionRef);
				const busMessageQueue:EntitySystemBusMessage[] = [];
				this.runSubsystemProgram(
					entityPath, entity,
					sk, expr, busMessageQueue, {}
				);
				this.replaceEntity(entityPath, this.handleSystemBusMessages(entityPath, entity, busMessageQueue));
				break;
			}
		}
	}
	
	protected doPoke( pokingEntityPath:EntityPath, pokingEntity:Entity, pokingSubsystemKey:string, pokingSubsystem:EntitySubsystem, pokeOffset:Vector3D ) {
		console.log(pokingEntityPath.join('/')+' is trying to poke at '+vectorToString(pokeOffset));
		
		// TODO: List all pokable things in Z column, *then* filter by reachability
		
		const pokingAppendage:Appendage = <Appendage>pokingSubsystem;
		if( pokingAppendage.maxReachDistance != undefined && vectorLength(pokeOffset) > pokingAppendage.maxReachDistance ) {
			console.log("Aww sorry you can't reach that far.  :(");
			return;
		}
		
		const pokableEntityFilter:EntityFilter = (
			roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass
		):boolean|undefined => {
			const subsystems = getEntitySubsystems(entity, this.gameDataManager);
			for( let sk in subsystems ) {
				const subsystem = subsystems[sk];
				switch( subsystem.classRef ) {
				case "http://ns.nuke24.net/Game21/EntitySubsystem/Button":
					return true;
				}
			}
			return undefined;
		}
		
		pokingEntityPath = this.fixEntityPathRoomId(pokingEntityPath);
		const roomEntity = this.getRoomEntity(pokingEntityPath);
		const pokedLocation = this.fixLocation({
			roomRef: pokingEntityPath[0],
			position: addVector(roomEntity.position, pokeOffset)
		});
		const pokedPosition = pokedLocation.position;
		const pokeCheckBb = makeAabb(0,0,-1, 0,0,+1);
		const foundPokableEntities = this.entitiesAt( pokedLocation.roomRef, pokedPosition, pokeCheckBb, pokableEntityFilter);
		for( let fpe in foundPokableEntities ) {
			const foundEntity = foundPokableEntities[fpe];
			this.deliverPoke(foundEntity.entityPath, foundEntity.entity);
		}
	}
	
	protected handleSubsystemBusMessage(
		entityPath:EntityPath, entity:Entity, subsystemKey:string, subsystem:EntitySubsystem, message:EntitySystemBusMessage, messageQueue:EntitySystemBusMessage[]
	):Entity|undefined {
		if( message.length < 1 ) {
			console.warn("Zero-length message passed to subsystem "+subsystemKey, message);
			return entity;
		}
		switch( subsystem.classRef ) {
		case "http://ns.nuke24.net/Game21/EntitySubsystem/InterEntityBusBridge":
			{
				this.enqueueAction({
					classRef: "http://ns.nuke24.net/Game21/SimulationAction/InduceSystemBusMessage",
					entityPath: subsystem.forwardEntityPath,
					busMessage: message,
					replyPath: entityPath,
				});
			}
			break;
		case "http://ns.nuke24.net/Game21/EntitySubsystem/Appendage":
			switch( message[0] ) {
			case '/poke':
				// TODO: enqueueAction instead of poking directly
				this.doPoke(entityPath, entity, subsystemKey, subsystem, {x:+message[1], y:+message[2], z:+message[3]});
				break;
			}
			break;
		case "http://ns.nuke24.net/Game21/EntitySubsystem/EntityMorpher":
			{
				if( message.length < 2 ) {
					console.warn("EntityMorpher recieved command that's too short.", message);
				}
				// Oh hey, we can do that right here!
				const resetEntityClassRef = ""+message[1];
				const resetToClassDefaults = !!message[2];
				const actuallyNeedsAnyModifications =
					(resetEntityClassRef != entity.classRef) ||
					(resetToClassDefaults && (
						entity.subsystems != undefined ||
						entity.maze1Inventory != undefined
					));
				if( !actuallyNeedsAnyModifications ) return entity;
				if( Object.isFrozen(entity) ) entity = thaw(entity);
				entity.classRef = resetEntityClassRef;
				if( resetToClassDefaults ) {
					delete entity.subsystems;
					delete entity.maze1Inventory;
				}
			}
			break;
		case "http://ns.nuke24.net/Game21/EntitySubsystem/SimpleComputer":
			{
				if( !subsystem.messageReceivedExpressionRef ) break;
				
				const vars:KeyedList<any> = {};
				if( subsystem.parameterVariableNames ) for( let i=0; i<subsystem.parameterVariableNames.length; ++i ) {
					const varName = subsystem.parameterVariableNames[i];
					vars[varName] = message[i+1];
				}
				
				const program = this.gameDataManager.getObject<esp.ProgramExpression>(subsystem.messageReceivedExpressionRef);
				// Will need to change something a bit in order to allow
				// data to be stored on the SimpleComputer
				this.runSubsystemProgram(entityPath, entity, subsystemKey, program, messageQueue, vars);
			}
			break;
		default:
			console.warn(subsystem.classRef+" recieved bus message, but handling of it is not implemented:", message);
			break;
		}
		return entity;
	}
	
	/**
	 * Handle a single bus message.
	 * This may cause new messages to go onto the queue,
	 * but handling those messages is left to the caller,
	 * probably handleSystemBusMessages.
	 */
	protected handleSystemBusMessage(
		entityPath:EntityPath, entity:Entity, message:EntitySystemBusMessage, busMessageQueue:EntitySystemBusMessage[]
	):Entity|undefined {
		if( message.length < 1 ) {
			console.warn("Zero length system bus message", message);
			return entity;
		}
		const path = ""+message[0];
		const ppre = /^\/([^\/]+)(\/.*|)$/;
		const pprem = ppre.exec(path);
		if( pprem == null ) {
			console.warn("Bad message path syntax: '"+path+"'");
			return entity;
		}
		
		const subsystemKey = pprem[1];
		const subsystem = getEntitySubsystem(entity, subsystemKey, this.gameDataManager);
		if( subsystem == undefined ) {
			// This might turn out to be a semi-normal occurrence,
			// in which case I should stop cluttering the log with it.
			
			if( !this.processSpecialEntityCommand(entityPath, entity, message ) ) {
				console.warn("Message to nonexistent subsystem (and not a special command, either) '"+pprem[1]+"'", message);	
			}
			return entity;
		}
		const subsystemMessage = [pprem[2], ...message.slice(1)];
		return this.handleSubsystemBusMessage(entityPath, entity, subsystemKey, subsystem, subsystemMessage, busMessageQueue);
	}
	
	protected handleSystemBusMessages(
		entityPath:EntityPath, entity:Entity|undefined, busMessageQueue:EntitySystemBusMessage[]
	):Entity|undefined {
		for( let i=0; i<busMessageQueue.length && entity != undefined; ++i ) {
			entity = this.handleSystemBusMessage(entityPath, entity, busMessageQueue[i], busMessageQueue);
		}
		return entity;
	}
	
	public sendProximalEventMessageToNearbyEntities(
		roomId:string, pos:Vector3D, maxDistance:number,
		message:ProximalSimulationMessage
	) {
		const proximalEventDetectingEntityFilter:EntityFilter = (
			roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass
		):boolean|undefined => {
			const detectorSystem = getEntitySubsystem(entity, ESSKEY_PROXIMALEVENTDETECTOR, this.gameDataManager);
			if( detectorSystem == undefined ) return false;
			switch( detectorSystem.classRef ) {
			case "http://ns.nuke24.net/Game21/EntitySubsystem/ProximalEventDetector":
				if( detectorSystem.eventDetectedExpressionRef ) return true;
			}
			return undefined;
		}
		
		// Ha ha for now just forward to UI.
		// TODO: Look for entities with ProximalEventDetectors,
		// pass this message to them.
		// The player's should be set up to forward to /controlleruplink,
		// Which should be translated to a message to the UI.
		const foundEntities = this.entitiesAt(roomId, pos, makeAabb(
			-maxDistance,-maxDistance,-maxDistance,
			+maxDistance,+maxDistance,+maxDistance
		), proximalEventDetectingEntityFilter );
		
		for( let fe in foundEntities ) {
			const foundEntity = foundEntities[fe];
			const iSys = getEntitySubsystem(foundEntity.entity, ESSKEY_PROXIMALEVENTDETECTOR, this.gameDataManager);
			if( !iSys ) continue;
			switch( iSys.classRef ) {
			case "http://ns.nuke24.net/Game21/EntitySubsystem/ProximalEventDetector":
				if( iSys.eventDetectedExpressionRef ) {
					// TODO: Clone message, add originPosition data.
					const fixedMessage = message;
					const expr = this.gameDataManager.getObject<esp.ProgramExpression>(iSys.eventDetectedExpressionRef);
					const busMessageQueue:EntitySystemBusMessage[] = []; 
					this.runSubsystemProgram(
						[foundEntity.roomRef, foundEntity.roomEntityId], foundEntity.entity,
						ESSKEY_PROXIMALEVENTDETECTOR, expr, busMessageQueue,
						{
							event: fixedMessage
						}
					);
					this.replaceEntity(
						foundEntity.entityPath,
						this.handleSystemBusMessages(foundEntity.entityPath, foundEntity.entity, busMessageQueue),
						foundEntity.entity
					);
				}
			}
		}
	}
	
	protected _mutateEntityAtPath( entity:Entity, entityPath:EntityPath, pathStart:number, mutator:(entity:Entity)=>Entity|undefined ) : Entity|undefined {
		if( pathStart == entityPath.length ) {
			return mutator(entity);
		}
		if( entityPath[pathStart] == AT_STRUCTURE_OFFSET ) {
			const offsetVector:Vector3D = parseVector(entityPath[pathStart+1]);
			const entityClass = this.gameDataManager.getEntityClass(entity.classRef);
			console.log(entityPath.join('/')+" offset "+pathStart+"; subdividing entity class "+entity.classRef+", which is structure type "+entityClass.structureType);
			if( entityClass.structureType == StructureType.TILE_TREE ) {
				// TODO: allow passing an aabb to rewriteTileTree
				// so that it skips parts we don't care about at all.
				const newTtClassRef = rewriteTileTreeIntersecting(
					ZERO_VECTOR, entity.classRef,
					offsetVector, ZERO_AABB,
					(pos:Vector3D, aabb:AABB, index:number, te:TileEntity|null|undefined) => {
						if( te == null ) return null;
						const newEnt = this._mutateEntityAtPath(te.entity, entityPath, pathStart+2, mutator);
						return newEnt == undefined ? null : {entity:newEnt};
					}, this.gameDataManager);
				if( newTtClassRef == entity.classRef ) return entity;
				entity = thaw(entity);
				entity.classRef = newTtClassRef;
				return entity;
			} else {
				throw new Error("Don't know how to @structureoffset when structure type = "+entityClass.structureType+
					"; class = "+entity.classRef+", entire path = "+entityPath.join('/'));
			}
		}
		throw new Error("Don't know how to do this mutation when next path key is '"+entityPath[pathStart]+"'");
	}
	
	protected mutateEntityAtPath( entityPath:EntityPath, mutator:(entity:Entity)=>Entity|undefined ) : void {
		const roomEntity = this.getRoomEntityOrUndefined(entityPath);
		if( roomEntity == undefined ) return undefined;
		let entity = roomEntity.entity;
		if( entity == undefined ) {
			console.warn("Couldn't find root "+entityPath.join('/'));
			return;
		}
		this._mutateEntityAtPath(entity, entityPath, 2, mutator);
	}
	
	protected replaceEntity(entityPath:EntityPath, entity:Entity|undefined, oldVersion?:Entity) {
		if( oldVersion != undefined && oldVersion === entity ) {
			// Nothing to do, ha ha ha.
			return;
		}
		this.mutateEntityAtPath(entityPath, () => entity);
	}
	
	protected induceSystemBusMessage(entityPath:EntityPath, message:EntitySystemBusMessage, replyPath?:EntityPath):void {
		if( entityPath[0] == ROOMID_SIMULATOR ) {
			this.processSimulatorCommand(message);
			return;
		}
		if( entityPath[0] == ROOMID_EXTERNAL ) {
			const dev = this.simulator.externalDevices[entityPath[1]];
			if( dev ) {
				dev.onMessage(message, replyPath);
			} else {
				console.warn("Cannot deliver system bus message to nonexistent external device '"+entityPath[1]+"'")
			}
			return;
		}
		this.mutateEntityAtPath(entityPath, (entity:Entity) => {
			return this.handleSystemBusMessages(entityPath, entity, [message]);
		});
	}
	
	protected doAction( act:SimulationAction ):void {
		switch( act.classRef ) {
		case "http://ns.nuke24.net/Game21/SimulationAction/InduceSystemBusMessage":
			this.induceSystemBusMessage(act.entityPath, act.busMessage, act.replyPath);
			break;
		default:
			console.warn("Skipping invocation of unsupported action class: "+act.classRef);
		}
	}
	
	public findEmptySpaceNear(bb:AABB, roomId:string, position:Vector3D):RoomLocation {
		let distance = 0;
		const filter:EntityFilter = (roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass) => {
			if( entityClass.structureType == StructureType.INDIVIDUAL ) {
				return entityClass.isSolid !== false;
			}
			return undefined;
		};
		for( let attempts=0; attempts<16; ++attempts ) {
			const placePos = {
				x:position.x + (Math.random()*2-1)*distance,
				y:position.y + (Math.random()*2-1)*distance,
				z:position.z
			};
			if( this.entitiesAt(roomId, placePos, bb, filter).length == 0 ) {
				return this.fixLocation({
					roomRef: roomId,
					position: placePos
				})
			}
			distance += 1/16;
		}
		throw new Error("Failed to find empty space!");
	}
	
	public placeItemSomewhereNear(entity:Entity, roomId:string, position:Vector3D, velocity:Vector3D=ZERO_VECTOR) {
		const entityClass = this.gameDataManager.getEntityClass(entity.classRef);
		const physBb = entityClass.physicalBoundingBox;
		if( entityClass.structureType != StructureType.INDIVIDUAL ) {
			throw new Error('placeItemSomewhereNear not meant to handle '+entityClass.structureType+'-structure-typed things');
		}
		const loc = this.findEmptySpaceNear(physBb, roomId, position);
		const room = this.gameDataManager.getMutableRoom(loc.roomRef);
		room.roomEntities[entity.id || newUuidRef()] = {
			position: loc.position,
			velocity: velocity,
			entity: entity
		}
	}
	
	public killRoomEntity(roomRef:string, entityRef:string) {
		// TODO: Replace with a energy / morph subsystem
		const room = this.gameDataManager.getMutableRoom(roomRef);
		const roomEntity = room.roomEntities[entityRef];
		if( roomEntity == undefined ) {
			console.warn("Can't kill entity "+roomRef+"/"+entityRef+" because that room entity's not found");
			return;
		}
		const entity = roomEntity.entity;
		if( entity.maze1Inventory ) for( let i in entity.maze1Inventory ) {
			try {
				this.placeItemSomewhereNear(entity.maze1Inventory[i], roomRef, roomEntity.position);
			} catch( err ) {
				console.warn("Uh oh, inventory item "+i+" was lost!");
			}
		}
		entity.maze1Inventory = {};
		entity.classRef = dat.deadPlayerEntityClassId;
		entity.subsystems = {};
		delete entity.desiredMovementDirection;
		delete entity.desiresMaze1AutoActivation; // Otherwise skeleton will steal your dropped keys! 
	}
	
	public findRoomEntity( match:string|EntityMatchFunction ):FoundEntity|undefined {
		const entityPath = this.findEntityInAnyLoadedRoom(match);
		if( entityPath == undefined ) return undefined;
		const room = this.gameDataManager.getRoom(entityPath[0]);
		
		const roomEntity = room.roomEntities[entityPath[1]];
		const entity = roomEntity.entity;
		const entityClass = this.gameDataManager.getEntityClass(entity.classRef);
		return {
			entityPath,
			roomRef: entityPath[0],
			roomEntityId: entityPath[1],
			roomEntity,
			entityPosition: roomEntity.position,
			entity,
			entityClass
		};
	}
	
	protected makeNewState():SimulationState {
		return {
			time: this.newTime,
			enqueuedActions: this.newEnqueuedActions,
			physicallyActiveRoomIdSet: this.newPhysicallyActiveRoomIdSet,
			rootRoomIdSet: this.initialSimulationState.rootRoomIdSet,
		}
	}
	
	public abstract doUpdate() : Promise<SimulationState>;
}

export class LogicUpdate extends SimulationUpdate {
	public doUpdate() : Promise<SimulationState> {
		this.newEnqueuedActions = []; // We're going to handle the current ones!
		this.newTime += this.simulator.logicStepDuration;
		const handlingActions = this.initialSimulationState.enqueuedActions;
		for( let ac in handlingActions ) {
			const act:SimulationAction = handlingActions[ac];
			this.doAction(act);
		}
		return Promise.resolve(this.makeNewState());
	}
}

export class PhysicsUpdate extends SimulationUpdate {
	public induceVelocityChange( roomId:string, entityId:string, roomEntity:RoomEntity, dv:Vector3D ):void {
		if( vectorIsZero(dv) ) return; // Save ourselves a little bit of work
		this.updateRoomEntity( roomId, entityId, {
			velocity: addVector(entityVelocity(roomEntity), dv)
		});
	}
	
	public registerReactionlessImpulse( roomId:string, entityId:string, roomEntity:RoomEntity, impulse:Vector3D ):void {
		const entityClass = this.gameDataManager.getEntityClass(roomEntity.entity.classRef);
		const mass = entityMass(entityClass);
		if( mass == Infinity ) return; // Nothing's going to happen
		this.induceVelocityChange(roomId, entityId, roomEntity, scaleVector(impulse, -1/mass));
	}
	
	public registerImpulse( eARoomId:string, entityAId:string, entityA:RoomEntity, eBRoomId:string, entityBId:string, entityB:RoomEntity, impulse:Vector3D ):void {
		if( vectorIsZero(impulse) ) return; // Save ourselves a little bit of work
		
		const eAClass = this.gameDataManager.getEntityClass(entityA.entity.classRef);
		const eBClass = this.gameDataManager.getEntityClass(entityB.entity.classRef);
		
		const eAMass = entityMass(eAClass);
		const eBMass = entityMass(eBClass);
		
		if( eAMass == Infinity && eBMass == Infinity ) return; // Nothing's going to happen
		
		const eAVel = entityVelocity(entityA);
		const eBVel = entityVelocity(entityB);
		
		let systemMass:number;
		let aRat:number, bRat:number;
		//let systemVelocity:Vector3D;
		if( eAMass == Infinity ) {
			systemMass = Infinity;
			aRat = 0; bRat = 1;
			//systemVelocity = eAVel;
		} else if( eBMass == Infinity ) {
			systemMass = Infinity;
			aRat = 1; bRat = 0;
			//systemVelocity = eBVel;
		} else {
			systemMass = eAMass + eBMass;
			aRat = (systemMass-eAMass)/systemMass;
			bRat = (systemMass-eBMass)/systemMass;
			//systemVelocity = addVector(scaleVector(eAVel, eAMass/systemMass), scaleVector(eBVel, eBMass/systemMass));
		}
		
		const relativeDv = scaleVector(impulse, 1/eBMass + 1/eAMass);
		//const eADv = scaleVector(impulse, -1/eAMass);
		
		if( aRat != 0 ) this.induceVelocityChange(eARoomId, entityAId, entityA, scaleVector(relativeDv, -aRat));
		if( bRat != 0 ) this.induceVelocityChange(eBRoomId, entityBId, entityB, scaleVector(relativeDv, +bRat));
	}
	
	public drainEnergy( entity:Entity, drain:number ):number {
		if( entity.storedEnergy == undefined ) return drain;
		//if( entity.storedEnergy == 0 ) return 0;
		drain = Math.min(entity.storedEnergy, drain);
		entity.storedEnergy -= drain;
		return drain;
	}
	
	public attemptInducedImpulse(
		eARoomId:string, entityAId:string, entityA:RoomEntity, eBRoomId:string, entityBId:string, entityB:RoomEntity, impulse:Vector3D
	):boolean {
		const requiredEnergy = vectorLength(impulse); // TODO: I don't think that's right.
		const availableEnergy = this.drainEnergy( entityA.entity, requiredEnergy );
		// TODO: Calculate actual impulse from available energy
		const adjustedImpulse = normalizeVector(impulse, availableEnergy);
		this.registerImpulse( eARoomId, entityAId, entityA, eBRoomId, entityBId, entityB, adjustedImpulse );
		return true;
	}	
	
	protected applyCollisions() {
		for( let collEntityAId in this.collisions ) {
			for( let collEntityBId in this.collisions[collEntityAId] ) {
				const collision:Collision = this.collisions[collEntityAId][collEntityBId];
				const eAClass = this.gameDataManager.getEntityClass(collision.roomEntityA.entity.classRef);
				const eBClass = this.gameDataManager.getEntityClass(collision.roomEntityB.entity.classRef);
				// TODO: Figure out collision physics better?
				const theBounceFactor = bounceFactor(eAClass, eBClass);
				const stopImpulse = scaleVector(collision.velocity, Math.min(entityMass(eAClass), entityMass(eBClass)));
				const bounceImpulse = scaleVector(stopImpulse, theBounceFactor);
				const eAVel = collision.roomEntityA.velocity || ZERO_VECTOR;
				const eBVel = collision.roomEntityB.velocity || ZERO_VECTOR;
				const eAPerpVel = perpendicularPart(eAVel, collision.velocity);
				const eBPerpVel = perpendicularPart(eBVel, collision.velocity);
				const frictionImpulse = normalizeVector(subtractVector(eAPerpVel,eBPerpVel),
					Math.max(eAClass.coefficientOfFriction || 0.25, eBClass.coefficientOfFriction || 0.25) *
					vectorLength(stopImpulse) *
					Math.max(0, 1-theBounceFactor)
				);
				const totalImpulse = {x:0,y:0,z:0};
				accumulateVector(stopImpulse, totalImpulse)
				accumulateVector(bounceImpulse, totalImpulse)
				accumulateVector(frictionImpulse, totalImpulse)
				this.registerImpulse(
					collision.roomAId, collEntityAId, collision.roomEntityA,
					collision.roomBId, collEntityBId, collision.roomEntityB,
					totalImpulse
				);
			}
		}
		this.collisions = {};
	}

	protected collisions:KeyedList<KeyedList<Collision>>;
	public registerCollision(
		roomAId:string, eAId:string, eA:RoomEntity,
		roomBId:string, eBId:string, eB:RoomEntity, velocity:Vector3D
	):void {
		if( eAId > eBId ) {
			return this.registerCollision( roomBId, eBId, eB, roomAId, eAId, eA, scaleVector(velocity, -1));
		}
		
		if( !this.collisions[eAId] ) this.collisions[eAId] = {};
		const already = this.collisions[eAId][eBId];
		
		if( already && vectorLength(already.velocity) > vectorLength(velocity) ) return;
		
		this.collisions[eAId][eBId] = {
			roomAId: roomAId,
			roomEntityA: eA,
			roomBId: roomBId,
			roomEntityB: eB,
			velocity: velocity
		}
	}
	
	protected borderingCuboid( roomRef:string, bb:AABB, dir:Vector3D, gridSize:number ):AABB {
		let minX = bb.minX, maxX = bb.maxX;
		let minY = bb.minY, maxY = bb.maxY;
		let minZ = bb.minZ, maxZ = bb.maxZ;
		if( dir.x < 0 ) {
			maxX = minX; minX -= gridSize; 
		} else if( dir.x > 0 ) {
			minX = maxX; maxX += gridSize;
		}
		if( dir.y < 0 ) {
			maxY = minY; minY -= gridSize; 
		} else if( dir.y > 0 ) {
			minY = maxY; maxY += gridSize;
		}
		if( dir.z < 0 ) {
			maxZ = minZ; minZ -= gridSize; 
		} else if( dir.z > 0 ) {
			minZ = maxZ; maxZ += gridSize;
		}
		return makeAabb( minX,minY,minZ, maxX,maxY,maxZ );
	}
	
	protected borderingEntities( roomRef:string, pos:Vector3D, bb:AABB, dir:Vector3D, gridSize:number, filter:EntityFilter ):FoundEntity[] {
		const border = this.borderingCuboid(roomRef, bb, dir, gridSize);
		return this.entitiesAt( roomRef, pos, border, filter );
	}
	
	protected massivestCollision( collisions:FoundEntity[] ):FoundEntity|undefined {
		let maxMass = 0;
		let massivest:FoundEntity|undefined = undefined;
		for( let c in collisions ) {
			const coll = collisions[c];
			const entityClass = this.gameDataManager.getEntityClass(coll.roomEntity.entity.classRef);
			const mass = entityMass(entityClass);
			if( mass > maxMass ) {
				maxMass = mass;
				massivest = coll;
			}
		}
		return massivest;
	}
	
	/**
	 * Finds the most massive (interactive, rigid) object in the space specified
	 */
	protected massivestBorderingEntity( roomRef:string, pos:Vector3D, bb:AABB, dir:Vector3D, gridSize:number, filter:EntityFilter ):FoundEntity|undefined {
		return this.massivestCollision( this.borderingEntities(roomRef, pos, bb, dir, gridSize, filter) );
	}
	
	protected neighboringEntities( roomRef:string, pos:Vector3D, bb:AABB, sideMask:number, gridSize:number, filter:EntityFilter ):KeyedList<FoundEntity[]> {
		const neighbors:KeyedList<FoundEntity[]> = {};
		for( let d in sideDirections ) {
			const xyzDir = sideDirections[d];
			if( ((+xyzDir)&sideMask) == 0 ) continue;
			const vec = xyzDirectionVectors[xyzDir];
			neighbors[xyzDir] = this.borderingEntities(roomRef, pos, bb, vec, gridSize, filter);
		}
		return neighbors;
	}

	/**
	 * What's around the entity?
	 */
	protected entityBounceBox( roomRef:string, pos:Vector3D, bb:AABB, sideMask:number, gridSize:number, filter:EntityFilter ):BounceBox {
		const bounceBox:BounceBox = {};
		for( let d in sideDirections ) {
			const xyzDir = sideDirections[d];
			if( ((+xyzDir)&sideMask) == 0 ) continue;
			const vec = xyzDirectionVectors[xyzDir];
			bounceBox[xyzDir] = this.massivestBorderingEntity(roomRef, pos, bb, vec, gridSize, filter);
		}
		return bounceBox;
	}
	
	protected snapGridSize = 1/8;
	
	/** Call this after you've ensured that all physically active rooms and their neighbors are cached. */
	protected doUpdate2() : void {
		const gdm = this.gameDataManager;
		const simulatedInterval = this.simulator.majorStepDuration;
		const gravDv = makeVector(0, 10*simulatedInterval, 0);
		const maxWalkForce = 450; // ~100 pounds of force?
		
		const entitiesToMove:{roomId:string, entityId:string, moveOrder:number}[] = [];
		const snapGridSize = this.snapGridSize;
		
		// Auto pickups!  And door opens.  And death.
		for( let r in this.initialSimulationState.physicallyActiveRoomIdSet ) {
			let room = this.gameDataManager.getMutableRoom(r);
			if( !room ) throw new Error("Somehow room '"+r+"' is in the active room IDs list, but there doesn't seem to be any such room");
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				const entity = roomEntity.entity;
				const reVel = roomEntity.velocity||ZERO_VECTOR;
				
				if( entity.classRef == dat.playerEntityClassId && entity.storedEnergy < 1 ) {
					this.killRoomEntity(r, re);
				}
				
				if( !entity.desiresMaze1AutoActivation ) continue;
				const entityClass = gdm.getEntityClass(entity.classRef);
				
				const pickupFilter:EntityFilter =
					(roomEntityId:string, roomEntity:RoomEntity, entity:Entity, _entityClass:EntityClass) =>
						_entityClass.structureType != StructureType.INDIVIDUAL ? undefined :
						_entityClass.isMaze1AutoPickup || _entityClass.cheapMaze1DoorKeyClassRef != undefined;
				const eBb = entityClass.physicalBoundingBox;
				const pickupBb = makeAabb(
					eBb.minX-snapGridSize, eBb.minY-snapGridSize, eBb.minZ-snapGridSize,
					eBb.maxX+snapGridSize, eBb.maxY+snapGridSize, eBb.maxZ+snapGridSize
				)
				
				const foundIois = this.entitiesAt(r, roomEntity.position, pickupBb, pickupFilter);
				checkIois: for( let p in foundIois ) {
					const foundIoi = foundIois[p];
					if(
						foundIoi.roomRef == r &&
						dotProduct(
							subtractVector(foundIoi.entityPosition, roomEntity.position),
							subtractVector(foundIoi.roomEntity.velocity||ZERO_VECTOR,reVel),
						) > 0
					) {
						// If they're moving away from each other, forget it!
						continue checkIois;
					}
					if( foundIoi.entityClass.isMaze1AutoPickup ) {
						let pickedUp:boolean;
						if( foundIoi.entityClass.isMaze1Edible ) {
							entity.storedEnergy += +foundIoi.entityClass.maze1NutritionalValue;
							pickedUp = true;
						} else {
							const inventorySize = entityClass.maze1InventorySize;
							if( inventorySize == undefined ) continue checkIois;
							if( entity.maze1Inventory == undefined ) entity.maze1Inventory = {};
							let currentItemCount = 0;
							let leastImportantItemKey:string|undefined;
							let leastImportantItemImportance:number = Infinity;
							for( let k in entity.maze1Inventory ) {
								++currentItemCount;
								const itemClass = gdm.getEntityClass(entity.maze1Inventory[k].classRef);
								const itemImportance = itemClass.maze1Importance || 0;
								if( itemImportance < leastImportantItemImportance ) {
									leastImportantItemImportance = itemImportance;
									leastImportantItemKey = k;
								}
							}
							if( currentItemCount >= inventorySize ) {
								if( leastImportantItemKey == undefined ) {
									console.warn("Can't pick up new item; inventory full and nothing to drop!")
									continue checkIois;
								}
								const foundItemImportance = foundIoi.entityClass.maze1Importance || 0;
								if( foundItemImportance < leastImportantItemImportance ) {
									continue checkIois;
								}
								const throwDirection = vectorIsZero(reVel) ? {x:1,y:0,z:0} : normalizeVector(reVel, -1);
								const throwStart = addVector(roomEntity.position, normalizeVector(throwDirection, 0.5));
								try {
									this.placeItemSomewhereNear(entity.maze1Inventory[leastImportantItemKey], r, throwStart, throwDirection);
								} catch( err ) {
									console.log("Couldn't drop less important item:", err);
									continue checkIois;
								}
								delete entity.maze1Inventory[leastImportantItemKey];
							}
							entity.maze1Inventory[foundIoi.roomEntityId] = foundIoi.entity;
							pickedUp = true;
						}
						if( pickedUp ) {
							this.sendProximalEventMessageToNearbyEntities(r, roomEntity.position, 8, {
								classRef: "http://ns.nuke24.net/Game21/SimulationMessage/ItemPickedUp",
								itemClassRef: foundIoi.entity.classRef,
								pickerPath: [r, re],
							});
							this.updateRoomEntity(foundIoi.roomRef, foundIoi.roomEntityId, {destroyed:true});
						}
					}
					doKey: if( foundIoi.entityClass.cheapMaze1DoorKeyClassRef ) {
						const requiredKeyClass = foundIoi.entityClass.cheapMaze1DoorKeyClassRef;
						const doorClass = foundIoi.entity.classRef;
						// Does player have one?
						if( entity.maze1Inventory ) {
							for( let k in entity.maze1Inventory ) {
								if( entity.maze1Inventory[k].classRef == requiredKeyClass ) {
									this.destroyCheapDoor( foundIoi.roomRef, foundIoi.entityPosition, doorClass );
									break doKey;
								}
							}
						}
					}
				}
			}
		}
		
		// Collect impulses
		// impulses from previous step are also included.
		for( let r in this.initialSimulationState.physicallyActiveRoomIdSet ) {
			let room = this.gameDataManager.getMutableRoom(r);
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				const entity = roomEntity.entity;
				const entityClass = gdm.getEntityClass(entity.classRef);
				
				if( entityClass.mass == null || entityClass.mass == Infinity ) {
					// This thing ain't going anywhere
					if( entity.desiredMovementDirection == null ) {
						// Nor is it attempting to apply forces onto anyone else.
						// So we can skip doing anything with it at all.
						continue;
					}
				}
				
				// Room's got a possibly active entity in it,
				// so add to the active rooms list.
				//this.markRoomPhysicallyActive(r);
				
				// TODO: Don't activate room if entity is settled into an unmoving state
				// (would require activating neighbor rooms when things at edges change, etc)
				
				if( entityClass.isAffectedByGravity && entityClass.mass != null && entityClass.mass != Infinity ) {
					this.registerReactionlessImpulse(r, re, roomEntity, scaleVector(gravDv, -entityClass.mass));
				}
				
				const otherEntityFilter:EntityFilter =
					(roomEntityId:string, roomEntity:RoomEntity, entity:Entity, _entityClass:EntityClass) =>
						roomEntityId != re;
				
				const neighbEnts = this.neighboringEntities(
					r, roomEntity.position, entityClass.physicalBoundingBox, ALL_SIDES, snapGridSize, otherEntityFilter );
				
				// TODO: Just use neighbEnts rather than querying again.
				const solidOtherEntityFilter:EntityFilter =
					(roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass) =>
						roomEntityId != re && entityClass.isSolid !== false;
				
				const floorCollision = this.massivestBorderingEntity(
					r, roomEntity.position, entityClass.physicalBoundingBox,
					xyzDirectionVectors[XYZDirection.POSITIVE_Y], snapGridSize, solidOtherEntityFilter);
				
				/*
				 * Possible forces:
				 * * Gravity pulls everything down
				 * - Entities may push directly off any surfaces (jump)
				 * - Entities may push sideways against surfaces that they are pressed against (e.g. floor)
				 * - Entities may climb along ladders or other climbable things
				 */
				
				const dmd = entity.desiredMovementDirection;
				let climbing = false;
				let walking = false;
				
				if( dmd != null && entityClass.climbingSkill && (floorCollision == null || dmd.y != 0) ) {
					const minClimbability = 1 - entityClass.climbingSkill;
					let mostClimbable:FoundEntity|undefined;
					let maxClimbability = 0;
					for( let dir in neighbEnts ) {
						const neighbEnts2 = neighbEnts[dir];
						for( let e in neighbEnts2 ) {
							const climbability = neighbEnts2[e].entityClass.climbability;
							if( climbability != null && climbability >= minClimbability && climbability >= maxClimbability ) {
								// Aw yih we can climb that!
								// Theoretically we would take direction of movement into account,
								// so if you wanted to go up you'd prefer a ladder that's itself moving that way.
								mostClimbable = neighbEnts2[e];
								maxClimbability = climbability;
							}
						}
					}
					if( mostClimbable ) {
						climbing = true;
						const maxClimbForce = entityClass.maxClimbForce || 0;
						const currentRv:Vector3D = subtractVector(entityVelocity(roomEntity), entityVelocity(mostClimbable.roomEntity));
						const maxClimbSpeed = entityClass.normalClimbingSpeed || entityClass.normalWalkingSpeed || 0;
						const climbImpulse = impulseForAtLeastDesiredVelocity(
							dmd, currentRv,
							entityClass.mass, gdm.getEntityClass(mostClimbable.roomEntity.entity.classRef).mass,
							maxClimbSpeed, simulatedInterval*maxClimbForce, -1
						);
						this.attemptInducedImpulse(
							r, re, roomEntity, mostClimbable.roomRef,
							mostClimbable.roomEntityId, mostClimbable.roomEntity, climbImpulse);
					}
				}
				
				let onFloor = false;
				
				// TODO: Do this in a generic way for any 'walking' entities
				walk: if( floorCollision && entityVelocity(roomEntity).y - entityVelocity(floorCollision.roomEntity).y >= 0 ) {
					onFloor = true;
					
					if( dmd == null ) break walk;
					/** Actual velocity relative to surface */
					const dvx = entityVelocity(roomEntity).x - entityVelocity(floorCollision.roomEntity).x;
					/** Desired velocity relative to surface */
					const targetDvx = (entityClass.normalWalkingSpeed || 0) * oneify(dmd.x);
					/** Desired velocity change */
					const attemptDdvx = targetDvx - dvx;
					// Attempt to change to target velocity in single tick
					const walkForce = clampAbs( -attemptDdvx*entityClass.mass/simulatedInterval, maxWalkForce );
					const walkImpulse = {x:walkForce*simulatedInterval, y:0, z:0};
					this.attemptInducedImpulse(
						r, re, roomEntity,
						floorCollision.roomRef, floorCollision.roomEntityId, floorCollision.roomEntity,
						walkImpulse);
					
					if( dmd.y < 0 && entityClass.maxJumpImpulse ) {
						const jumpImpulse:Vector3D = {x:0, y:entityClass.maxJumpImpulse, z:0};
						if( this.attemptInducedImpulse(
							r, re, roomEntity,
							floorCollision.roomRef, floorCollision.roomEntityId, floorCollision.roomEntity, jumpImpulse)
						) {
							this.sendProximalEventMessageToNearbyEntities( r, roomEntity.position, 8, {
								classRef: "http://ns.nuke24.net/Game21/SimulationMessage/SimpleEventOccurred",
								eventCode: "jump",
							});
						}
					}
				} else {
					if( dmd && dmd.y < 0 && entityClass.maxJumpImpulse ) {
						//console.log(re+" can't jump; not on floor.", dmd.y);
					}
				}
				
				if( !climbing && !onFloor && dmd && entityClass.maxFlyingForce ) {
					this.registerReactionlessImpulse(
						r, re, roomEntity, scaleVector(dmd, -entityClass.maxFlyingForce*simulatedInterval) );
				}
				
				if( roomEntity.velocity && !vectorIsZero(roomEntity.velocity) ) {
					const moveOrder = -dotProduct(roomEntity.position, roomEntity.velocity);
					entitiesToMove.push( {roomId: r, entityId: re, moveOrder} );
				}
			}
		}
		
		entitiesToMove.sort( (a,b):number => a.moveOrder - b.moveOrder );
		
		// Apply velocity to positions,
		// do collision detection to prevent overlap and collection collisions
		this.collisions = {};
		
		for( const etm in entitiesToMove ) {
			const entityToMove = entitiesToMove[etm];
			const room = this.gameDataManager.getMutableRoom(entityToMove.roomId);
			const entityId = entityToMove.entityId;
			{
				const roomEntity = room.roomEntities[entityId];
				const velocity:Vector3D|undefined = roomEntity.velocity;
				if( velocity == null || vectorIsZero(velocity) ) continue;
				
				const entity = roomEntity.entity;
				const entityClass = gdm.getEntityClass(entity.classRef);
				const entityBb = entityClass.physicalBoundingBox;

				let entityRoomRef = entityToMove.roomId;
				
				let displacement = scaleVector( velocity, simulatedInterval );

				const solidOtherEntityFilter:EntityFilter =
					(roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass) =>
						roomEntityId != entityId && entityClass.isSolid !== false;
				
				// Strategy here is:
				// figure [remaining] displacement based on velocity*interval
				// while remaining displacement > 0 {
				//   move along velocity vector as far as possible without collision
				//   based on objects in path of remaining displacement, apply impulses,
				//   calculate remaining displacement along surfaces
				// }
				
				let iter = 0;
				displacementStep: while( displacement && !vectorIsZero(displacement) ) {
					const maxDisplacementComponent =
						Math.max( Math.abs(displacement.x), Math.abs(displacement.y), Math.abs(displacement.z) );
					// How much of it can we do in a single step?
					const stepDisplacementRatio = Math.min(snapGridSize, maxDisplacementComponent) / maxDisplacementComponent;
					
					// Attempt displacing!
					const stepDeltaPos = scaleVector( displacement, stepDisplacementRatio ); 
					const newVelocityLocation = this.fixLocation({
						roomRef: entityRoomRef,
						position: addVector(
							roomEntity.velocityPosition || roomEntity.position,
							stepDeltaPos
						)
					});
					const newRoomRef = newVelocityLocation.roomRef;
					const newPosition = roundVectorToGrid(newVelocityLocation.position, snapGridSize);
					const collisions = this.entitiesAt(newVelocityLocation.roomRef, newPosition, entityBb, solidOtherEntityFilter);
					if( collisions.length == 0 ) {
						this.updateRoomEntity(entityRoomRef, entityId, {
							roomRef: newRoomRef,
							position: newPosition,
							velocityPosition: newVelocityLocation.position
						});
						entityRoomRef = newRoomRef;
						if( stepDisplacementRatio == 1 ) break displacementStep; // Shortcut; this should happen anyway
						// Subtract what we did and go again
						displacement = addVector(displacement, scaleVector(displacement, -stepDisplacementRatio));
						continue displacementStep;
					}
					
					// Uh oh, we've collided somehow.
					// Need to take that into account, zero out part or all of our displacement
					// based on where the obstacle was, register some impulses
					
					{
						// TODO: Only need bounce box for directions moving in
						const bounceBox:BounceBox = this.entityBounceBox(
							entityRoomRef, roomEntity.position, entityBb, ALL_SIDES, snapGridSize, solidOtherEntityFilter );
						
						let maxDvx = 0;
						let maxDvxColl:FoundEntity|undefined;
						let maxDvy = 0;
						let maxDvyColl:FoundEntity|undefined;
						
						let remainingDx = displacement.x;
						let remainingDy = displacement.y;

						// Is there a less repetetive way to write this?
						// Check up/down/left/right to find collisions.
						// If nothing found, then it must be a diagonal collision!
						// So then check diagonals.
						let coll:FoundEntity|undefined;
						if( displacement.x > 0 && (coll = bounceBox[XYZDirection.POSITIVE_X]) ) {
							remainingDx = 0;
							const collVel = entityVelocity(coll.roomEntity);
							const dvx = velocity.x - collVel.x;
							if( dvx > maxDvx ) {
								maxDvx = dvx;
								maxDvxColl = coll;
							}
						}
						if( displacement.x < 0 && (coll = bounceBox[XYZDirection.NEGATIVE_X]) ) {
							remainingDx = 0;
							const collVel = entityVelocity(coll.roomEntity);
							const dvx = velocity.x - collVel.x;
							if( dvx < maxDvx ) {
								maxDvx = dvx;
								maxDvxColl = coll;
							}
						}
						if( displacement.y > 0 && (coll = bounceBox[XYZDirection.POSITIVE_Y]) ) {
							remainingDy = 0;
							const collVel = entityVelocity(coll.roomEntity);
							const dvy = velocity.y - collVel.y;
							if( maxDvyColl == null || dvy > maxDvy ) {
								maxDvy = dvy;
								maxDvyColl = coll;
							}
						}
						if( displacement.y < 0 && (coll = bounceBox[XYZDirection.NEGATIVE_Y]) ) {
							remainingDy = 0;
							const collVel = entityVelocity(coll.roomEntity);
							const dvy = velocity.y - collVel.y;
							if( dvy < maxDvy ) {
								maxDvy = dvy;
								maxDvyColl = coll;
							}
						}
						
						if( maxDvxColl ) {
							this.registerCollision(
								newRoomRef, entityId, roomEntity,
								maxDvxColl.roomRef, maxDvxColl.roomEntityId, maxDvxColl.roomEntity, makeVector(maxDvx, 0, 0) 
							);
						}
						if( maxDvyColl ) {
							this.registerCollision(
								newRoomRef, entityId, roomEntity,
								maxDvyColl.roomRef, maxDvyColl.roomEntityId, maxDvyColl.roomEntity, makeVector(0, maxDvy, 0)
							);
						}
						
						// New displacement = displacement without the components that
						// would take us into obstacles:
						if( remainingDx != 0 && remainingDy != 0 ) {
							// A diagonal hit, probably.
							// Keep the larger velocity component
							if( Math.abs(remainingDx) < Math.abs(remainingDy) ) {
								remainingDx = 0;
							} else {
								remainingDy = 0;
							}
						}
						
						displacement = { x: remainingDx, y: remainingDy, z: 0 };
						
						++iter;
						if( iter > 2 ) {
							console.log("Too many displacement steps while moving "+entityId+":", roomEntity, "class:", entityClass, "iter:", iter, "velocity:", velocity, "displacement:", displacement, "bounceBox:", bounceBox, "max dvx coll:", maxDvxColl, "max dby coll:", maxDvyColl);
							break displacementStep;
						}
					}
				}
			}
		}
		
		this.applyCollisions();
	}
	
	public doUpdate():Promise<SimulationState> {
		const loadRoomIds:LWSet<RoomID> = {};
		return this.fullyLoadRoomsAndImmediateNeighbors(loadRoomIds).then( () => {
			this.newPhysicallyActiveRoomIdSet = {}; // It will be rewritten by the update!
			this.doUpdate2();
			return this.makeNewState()
		});
	}
}

export interface ExternalDevice {
	onMessage( bm:EntitySystemBusMessage, sourcePath?:EntityPath ):void
}

interface InternalSystemProgramEvaluationContext {
	entityPath : EntityPath,
	entity : Entity,
	busMessageQueue : EntitySystemBusMessage[],
	subsystemKey : string;
	variableValues : KeyedList<any>;
};

type ISPEC = InternalSystemProgramEvaluationContext;

function evalInternalSystemProgram( expression:esp.ProgramExpression, ctx:ISPEC ):any {
	switch( expression.classRef ) {
	case "http://ns.nuke24.net/TOGVM/Expressions/LiteralString":
	case "http://ns.nuke24.net/TOGVM/Expressions/LiteralNumber":
	case "http://ns.nuke24.net/TOGVM/Expressions/LiteralBoolean":
		return expression.literalValue;
	case "http://ns.nuke24.net/TOGVM/Expressions/ArrayConstruction":
		const argValues:any[] = [];
		for( let i=0; i<expression.values.length; ++i ) {
			argValues.push(evalInternalSystemProgram(expression.values[i], ctx));
		}
		return argValues;
	case "http://ns.nuke24.net/TOGVM/Expressions/Variable":
		return ctx.variableValues[expression.variableName];
	case "http://ns.nuke24.net/TOGVM/Expressions/FunctionApplication":
		{
			const argValues:any[] = [];
			for( let i=0; i<expression.arguments.length; ++i ) {
				argValues.push(evalInternalSystemProgram(expression.arguments[i], ctx));
			}
			if( !expression.functionRef ) throw new Error("Oh no dynamic functions not implemented boo");
			switch( expression.functionRef ) {
			case "http://ns.nuke24.net/InternalSystemFunctions/Trace":
				console.debug("Trace from entity subsystem program", argValues, ctx);
				break;
			case "http://ns.nuke24.net/InternalSystemFunctions/ProgN":
				return argValues.length == 0 ? undefined : argValues[argValues.length-1];
			case "http://ns.nuke24.net/InternalSystemFunctions/SendBusMessage":
				if( argValues.length == 1 ) { 
					const bm = argValues[0];
					if( !Array.isArray(bm) || bm.length < 1 || typeof bm[0] != 'string' ) {
						throw new Error("Entity message must be an array with string as first element");
					}
					ctx.busMessageQueue.push( bm );
					return null;
				} else {
					throw new Error("SendBusMessage given non-1 arguments: "+JSON.stringify(argValues));
				}
			default:
				throw new Error("Call to unsupported function "+expression.functionRef);
			}
		}
		break;
	default:
		throw new Error(
			"Dunno how to evaluate expression classcamp town ladies sing this song, do da, do da, "+
			"camp town race track five miles long, oh da do da day: "+expression.classRef);
	}
}

function fastForwardTime(state:SimulationState, targetTime:number):SimulationState {
	if( state.time >= targetTime ) return state;
	return {
		enqueuedActions: state.enqueuedActions,
		physicallyActiveRoomIdSet: state.physicallyActiveRoomIdSet,
		rootRoomIdSet: state.rootRoomIdSet,
		time: targetTime,
	}
}

function appendActions(state:SimulationState, newActions:SimulationAction[]):SimulationState {
	if( newActions.length == 0 ) return state;
	return {
		enqueuedActions: state.enqueuedActions.concat(newActions),
		physicallyActiveRoomIdSet: state.physicallyActiveRoomIdSet,
		rootRoomIdSet: state.rootRoomIdSet,
		time: state.time,
	}
}

type StateUpdater = (sim:Maze1Simulator, state:SimulationState)=>Promise<SimulationState>;

export default class Maze1Simulator {
	/*
	 * Updates are done in 'major steps',
	 * which consist of 0...n logic updates, a physics update,
	 * and then 0...n more logic updates.
	 * 
	 * A 'major state' is a state before and after a major update.
	 */
	
	/** Promise for the latest major state update */
	protected _currentMajorStatePromise : Promise<SimulationState>;
	public logger:Logger = console;
	public externalDevices:KeyedList<ExternalDevice> = {};
	public registerExternalDevice( name:string, dev:ExternalDevice ):void {
		this.externalDevices[name] = dev;
	}
	
	protected _enqueuedActions:SimulationAction[] = [];
	
	public constructor( public gameDataManager:GameDataManager, protected state:SimulationState ) {
		this._currentMajorStatePromise = Promise.resolve(state);
	}
	
	public majorStepDuration:number = 1/16;
	public logicStepDuration:number = 1/8192;
	
	protected slurpEnqueuedActionsInto(state:SimulationState):SimulationState {
		if( this._enqueuedActions.length > 0 ) {
			state = appendActions(state, this._enqueuedActions);
			this._enqueuedActions = [];
		}
		return state;
	}
	
	protected doLogicUpdates(initialState:SimulationState, targetTime:number):Promise<SimulationState> {
		// Any newly enqueued actions we want to act on ASAP, so:
		initialState = this.slurpEnqueuedActionsInto(initialState);
		if( initialState.time >= targetTime || initialState.enqueuedActions.length == 0 ) {
			return Promise.resolve(fastForwardTime(initialState, targetTime));
		}
		
		const step = new LogicUpdate(this, initialState);
		return step.doUpdate().then( (newState) => this.doLogicUpdates(newState, targetTime) );
	}
	
	protected interStateUpdaters:StateUpdater[] = [];
	
	protected doInterStateUpdates(state:SimulationState, i:number=0 ):Promise<SimulationState> {
		if( i < this.interStateUpdaters.length ) {
			return this.interStateUpdaters[i](this, state).then( (newState) => this.doInterStateUpdates(newState, i+1) );
		}
		return Promise.resolve(state);
	}
	
	protected prevUpdateStart:number = 0;
	public update():Promise<SimulationState> {
		return this._currentMajorStatePromise = this._currentMajorStatePromise.then( (state0) => {
			const realStartTime = new Date().valueOf()/1000;
			//console.log("Major update! "+realStartTime+" ("+(realStartTime-this.prevUpdateStart).toFixed(2)+" since previous");
			this.prevUpdateStart = realStartTime;
			const startTime = state0.time; // At the beginning of a major step they should match!
			const midTime = startTime + this.majorStepDuration/2;
			const endTime = startTime + this.majorStepDuration;
			return this.doLogicUpdates(state0, midTime).then( (state1) => {
				// The physics step appears to happen instantaneously, I guess.
				const physicsStep = new PhysicsUpdate(this, state1);
				return physicsStep.doUpdate();
			}).then( (state2) => {
				return this.doLogicUpdates(state2, endTime);
			}).then( (state3) => this.doInterStateUpdates(state3) );
		});
	}
	
	// A promise representing the new state created or to-be created
	// by the most recent call to update().
	// Anything .then()ned on this promise
	// should in theory run before the next update starts.
	// (though of course anything started asynchronously from within that
	// is liable to run in the middle of an update).
	public get currentStatePromise() : Promise<SimulationState> {
		return this._currentMajorStatePromise;
	}
	
	public registerRegularInterStateUpdateer( updater:StateUpdater ) {
		this.interStateUpdaters.push(updater);
	}
	
	public doOneOffInterStateUpdate( updater:StateUpdater ):Promise<SimulationState> { 
		return this._currentMajorStatePromise = this._currentMajorStatePromise.then( (state) => updater(this,state) );
	}
	
	public enqueueAction( action:SimulationAction ) {
		this._enqueuedActions.push(action);
	}
	
	public flushUpdates():Promise<HardSimulationState> {
		return this._currentMajorStatePromise.then( (state):Promise<HardSimulationState> => {
			return this.gameDataManager.flushUpdates().then( (dataRef):HardSimulationState => ({
				time: state.time,
				enqueuedActions: state.enqueuedActions,
				physicallyActiveRoomIdSet: state.physicallyActiveRoomIdSet,
				rootRoomIdSet: state.rootRoomIdSet,
				dataRef
			}))
		});
	}
}
