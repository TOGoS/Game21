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
	vectorLength, vectorIsZero, vectorHasAnyNonFiniteComponents, dotProduct, roundVectorToGrid
} from './vector3dmath';
import * as dat from './maze1demodata';
import Logger from './Logger';
import GameDataManager from './GameDataManager';
import { thaw } from './DeepFreezer';
import SimulationState, {HardSimulationState} from './Maze1SimulationState';
import SimulationUpdate from './Maze1SimulationUpdate';
import VisionUpdate from './Maze1VisionUpdate';
import {
	ExternalDevice,
	SimulationUpdateContext,
	FoundEntity,
	EntityFilter
} from './maze1simulationstuff'; 
import {
	HardRef, SoftRef, LWSet
} from './lwtypes';

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

type BounceBox = { [k:number]: FoundEntity|undefined }

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
		for( let r in this.initialSimulationState.physicallyActiveRoomIdSet || {} ) {
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
		for( let r in this.initialSimulationState.physicallyActiveRoomIdSet || {} ) {
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
				
				if( vectorHasAnyNonFiniteComponents(velocity) ) {
					console.warn("Oh no, velocity got all weird: "+vectorToString(velocity)+" (entity "+entityId+", class "+entity.classRef+")");
					continue;
				}
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
				
				let totalIterations = 0;
				let collisionIterations = 0;
				displacementStep: while( displacement && !vectorIsZero(displacement) ) {
					if( vectorHasAnyNonFiniteComponents(displacement) ) {
						console.warn("OH NO, displacement got weird: "+vectorToString(displacement) )
						break displacementStep;
					}
					++totalIterations;
					if( totalIterations > 20 ) {
						// Something got going really fast.
						// Or some velocity became infinite?  Which would be a problem.
						break displacementStep;
					}
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
						
						++collisionIterations;
						if( collisionIterations > 2 ) {
							console.log("Too many displacement steps while moving "+entityId+":", roomEntity, "class:", entityClass, "iter:", collisionIterations, "velocity:", velocity, "displacement:", displacement, "bounceBox:", bounceBox, "max dvx coll:", maxDvxColl, "max dby coll:", maxDvyColl);
							break displacementStep;
						}
					}
				}
			}
		}
		
		this.applyCollisions();
	}
	
	public doUpdate():Promise<SimulationState> {
		return this.fullyLoadRoomsAndImmediateNeighbors(this.initialSimulationState.physicallyActiveRoomIdSet || {}).then( () => {
			this.newPhysicallyActiveRoomIdSet = {}; // It will be rewritten by the update!
			this.doUpdate2();
			return this.makeNewState()
		});
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

export default class Maze1Simulator implements SimulationUpdateContext {
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
			}).then( (state1b) => {
				const visionStep = new VisionUpdate(this, state1b);
				return visionStep.doUpdate();
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
