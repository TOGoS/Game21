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
	RoomRef as RoomID,
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
	FoundEntity,
	RoomEntityUpdate,
	EntityFilter,
} from './maze1simulationstuff';
import {
	accumulateVector, addVector, subtractVector, scaleVector, normalizeVector,
	vectorLength, vectorIsZero, vectorHasAnyNonFiniteComponents, dotProduct, roundVectorToGrid
} from './vector3dmath';
import * as dat from './maze1demodata';
import EntitySystemBusMessage from './EntitySystemBusMessage';
import * as esp from './internalsystemprogram';
import Logger from './Logger';
import GameDataManager from './GameDataManager';
import newUuidRef from './newUuidRef';
import { pickOne } from './graphmaze/picking';
import { thaw } from './DeepFreezer';

const entityPositionBuffer:Vector3D = makeVector(0,0,0);

type EntityMatchFunction = (path:EntityPath,e:Entity)=>boolean;

import {
	HardRef, SoftRef, LWSet
} from './lwtypes';
import SimulationState from './Maze1SimulationState';
import { SimulationUpdateContext } from './maze1simulationstuff';

/**
 * Base class for update steps
 * with a whole bunch of handy functions.
 */
abstract class SimulationUpdate {
	protected gameDataManager:GameDataManager;
	protected newEnqueuedActions:SimulationAction[];
	protected newPhysicallyActiveRoomIdSet : LWSet<RoomID>;
	protected newVisiblyUpdatedRoomIdSet : LWSet<RoomID>;
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
		protected simulator:SimulationUpdateContext,
		protected initialSimulationState:SimulationState,
	) {
		this.gameDataManager = simulator.gameDataManager;
		this.logger = simulator.logger;
		// By default, don't change much.
		// Different updates can rewrite these in doUpdate() before calling makeNewState()
		this.newEnqueuedActions = this.initialSimulationState.enqueuedActions;
		this.newPhysicallyActiveRoomIdSet = this.initialSimulationState.physicallyActiveRoomIdSet || {};
		this.newVisiblyUpdatedRoomIdSet = this.initialSimulationState.visiblyUpdatedRoomIdSet || {};
		this.newTime = this.initialSimulationState.time;
	}
	
	protected markRoomPhysicallyActive(roomId:RoomID):void {
		this.newPhysicallyActiveRoomIdSet[roomId] = true;
	}
	protected markRoomVisiblyUpdated(roomId:RoomID):void {
		this.newVisiblyUpdatedRoomIdSet[roomId] = true;
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
	
	protected fullyLoadImmediateNeighbors( room:Room, loadingRoomIdSet:LWSet<RoomID> ):Promise<any> {
		const newPromises:Promise<Room>[] = [];
		if( room.neighbors ) for( let n in room.neighbors ) {
			const nrRef = room.neighbors[n].roomRef;
			if( !loadingRoomIdSet[nrRef] ) {
				loadingRoomIdSet[nrRef] = true;
				newPromises.push(this.fullyCacheRoom(nrRef));
			}
		}
		return Promise.all(newPromises);
	}
	
	public fullyLoadRoomsAndImmediateNeighbors( roomIds:LWSet<RoomID> ):Promise<LWSet<RoomID>> {
		const newPromises:Promise<any>[] = [];
		const loadingRoomIdSet:LWSet<RoomID> = {};
		for( let r in roomIds ) {
			if( !loadingRoomIdSet[r] ) {
				loadingRoomIdSet[r] = true;
				// Due to the nature of primises,
				// allPromises will first be filled with fully load room + neighbor promises,
				// then the remaining neighbor ones.
				newPromises.push(this.fullyLoadRoom(r).then( (room) => this.fullyLoadImmediateNeighbors(room, loadingRoomIdSet) ));
			}
		}
		return Promise.all(newPromises).then( () => loadingRoomIdSet );
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
		if( !roomEntity ) {
			console.warn("Whoops, can't update room entity because it's not there! "+roomRef+"/"+entityId);
			return;
		}
		if( update.destroyed ) {
			delete room.roomEntities[entityId];
			this.markRoomVisiblyUpdated(roomRef);
			return;
		}
		if( update.velocity ) {
			if( vectorHasAnyNonFiniteComponents(update.velocity) ) {
				console.warn("Refusing to goof up velocity to non-finite values: "+vectorToString(update.velocity));
			} else {
				roomEntity.velocity = update.velocity;
			}
		}
		if( update.position ) {
			this.markRoomVisiblyUpdated(roomRef);
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
		if( update.velocityPosition ) {
			roomEntity.velocityPosition = update.velocityPosition;
		}
		let newRoomRef = roomRef;
		if( update.roomRef != null && update.roomRef != roomRef ) {
			newRoomRef = update.roomRef;
			let newRoom : Room = this.getMutableRoom(update.roomRef);
			newRoom.roomEntities[entityId] = roomEntity;
			this.markRoomVisiblyUpdated(update.roomRef);
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
		this.markRoomVisiblyUpdated(entityPath[0]); // Not necessarily true (since we don't know what the mutation was), but probably
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
			// Well except for this (assuming entity may have been mutated)
			this.markRoomVisiblyUpdated(entityPath[0]); // Not necessarily true (since we don't know what the mutation was), but probably
			return;
		}
		this.mutateEntityAtPath(entityPath, () => entity);
	}
	
	/**
	 * Do some arbitrary update, process any resulting bus messages,
	 * and replace the entity if needed.
	 */
	protected doEntitySubsystemUpdate(
		entityPath:EntityPath, entity:Entity,
		update:(entity:Entity, messageQueue:EntitySystemBusMessage)=>Entity|undefined,
		messageQueue:EntitySystemBusMessage[] = []
	):void {
		let newEntity:Entity|undefined = update(entity, messageQueue);
		if( newEntity ) newEntity = this.handleSystemBusMessages(entityPath, newEntity, messageQueue);
		this.replaceEntity(entityPath, newEntity, entity);
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
			visiblyUpdatedRoomIdSet: this.newVisiblyUpdatedRoomIdSet,
			rootRoomIdSet: this.initialSimulationState.rootRoomIdSet,
		}
	}
	
	public abstract doUpdate() : Promise<SimulationState>;
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

export default SimulationUpdate;
