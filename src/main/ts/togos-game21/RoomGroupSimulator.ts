import ProceduralShape from './ProceduralShape';
import Rectangle from './Rectangle';
import Cuboid from './Cuboid';
import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import KeyedList from './KeyedList';
import { newUuidRef } from './DemoWorldGenerator';
import { PhysicalObjectType, PhysicalObject, ProtoObject, TileTree, Room, Game, HUNIT_CUBE } from './world';
import { eachSubObject } from './worldutil';
import { deepFreeze, isDeepFrozen, thaw } from './DeepFreezer';
import { coalesce2 } from './util';

function defreezeItem<T>( c:any, k:any, o?:T ):T {
	if( o == null ) o = c[k];
	if( o == null ) throw new Error("Failed to defreeze something["+k+"] because it's null");
	if( isDeepFrozen(o) ) c[k] = o = thaw(o);
	return o;
}

function objectName(object:PhysicalObject, k:string):string {
	let name = '';
	if( object.debugLabel ) name += object.debugLabel + ' ';
	name += k;
	return name; 
}

function vectorStr(v:Vector3D):string {
	return "<"+v.x.toPrecision(4)+", "+v.y.toPrecision(4)+", "+v.z.toPrecision(4)+">";
}

function vectorToBoundingBoxFitScale( v:Vector3D, bb:Cuboid, bbScale:number ):number {
	let dScale = 1; // How much v will need to be scaled by to fit within bb*bbScale
	if( v.x*dScale > bb.maxX * bbScale ) dScale *= ((bb.maxX * bbScale) / v.x);
	if( v.x*dScale < bb.minX * bbScale ) dScale *= ((bb.minX * bbScale) / v.x);
	if( v.y*dScale > bb.maxY * bbScale ) dScale *= ((bb.maxY * bbScale) / v.y);
	if( v.y*dScale < bb.minY * bbScale ) dScale *= ((bb.minY * bbScale) / v.y);
	if( v.z*dScale > bb.maxZ * bbScale ) dScale *= ((bb.maxZ * bbScale) / v.z);
	if( v.z*dScale < bb.minZ * bbScale ) dScale *= ((bb.minZ * bbScale) / v.z);
	return dScale;
}

function fitVectorToBoundingBox( v:Vector3D, bb:Cuboid, bbScale:number, dest?:Vector3D ):Vector3D {
	const dScale = vectorToBoundingBoxFitScale(v, bb, bbScale);
	return v.scale( dScale, dest );
}

function displacedCuboid( c:Cuboid, d:Vector3D, dest:Cuboid ):Cuboid {
	dest.minX = c.minX + d.x;
	dest.minY = c.minY + d.y;
	dest.minZ = c.minZ + d.z;
	dest.maxX = c.maxX + d.x;
	dest.maxY = c.maxY + d.y;
	dest.maxZ = c.maxZ + d.z;
	return dest;
}

declare function Symbol(name:string):symbol;

type CollisionCallback = (
	room0Ref:string, rootObj0Ref:string, proto0:ProtoObject, pos0:Vector3D, vel0:Vector3D,
	room1Ref:string, rootObj1Ref:string, proto1:ProtoObject, pos1:Vector3D, vel1:Vector3D
) => void;

const obj1RelativePosition = new Vector3D;
const objBRelativePosition = new Vector3D;
const obj1RelativeCuboid = new Cuboid;
const neighborRelativeCuboid = new Cuboid;

const roomRefSym = Symbol("room reference");
function objRoomRef(obj:PhysicalObject):string { return (<any>obj)[roomRefSym]; }
function setObjRoomRef(obj:PhysicalObject, roomRef:string):void { (<any>obj)[roomRefSym] = roomRef; }

export default class RoomGroupSimulator {
	public time = 0;
	public gravityVector:Vector3D = Vector3D.ZERO;
	protected _game:Game;
	protected activeObjects:KeyedList<PhysicalObject>;
	
	constructor(game:Game) {
		this.game = game;
	}
	
	protected prototype( obj:PhysicalObject ) {
		const proto = this.game.protoObjects[obj.prototypeRef];
		if( proto == undefined ) throw new Error("Failed to find prototype "+obj.prototypeRef);
		return proto;
	}
	
	protected objectIsActive( obj:PhysicalObject ) {
		if( obj.velocity != null && !obj.velocity.isZero ) return true;
		if( this.prototype(obj).isAffectedByGravity ) return true;
		// Potentially other things!
		return false;
	}
	
	public get game():Game { return this._game; }
	public set game(g:Game) {
		this._game = g;
		this.refreshCache();
	}
	
	/**
	 * Call when game has been changed
	 * to fix up any cached data
	 */
	public refreshCache():void {
		this.activeObjects = {};
		if( this._game == null ) return;
		for( let r in this._game.rooms ) {
			const room = this._game.rooms[r];
			for( let o in room.objects ) {
				const obj = room.objects[o];
				setObjRoomRef(obj, r);
				if( this.objectIsActive(obj) ) {
					this.activeObjects[o] = obj;
				}
			}
		}
	}
	
	public getObject(objRef:string):PhysicalObject {
		// TODO: If not in active objects,
		// may have to iterate through rooms to find.
		return this.activeObjects[objRef];
	}
	
	public objectRoomRef(obj:PhysicalObject):string {
		return objRoomRef(obj);
	}
	
	protected _findCollision2(
		room0Ref:string, rootObj0Ref:string, proto0:ProtoObject, pos0:Vector3D, vel0:Vector3D,
		room1Ref:string, rootObj1Ref:string, proto1:ProtoObject, pos1:Vector3D, vel1:Vector3D,
		callback:CollisionCallback
	):void {
		obj1RelativePosition.set(
			pos1.x - pos0.x,
			pos1.y - pos0.y,
			pos1.z - pos0.z
		);
		
		displacedCuboid(proto1.physicalBoundingBox, obj1RelativePosition, obj1RelativeCuboid);
		
		const obj0Cuboid = proto0.physicalBoundingBox;
		// Touching at the edge counts as a collision because we'll want to figure friction, etc
		if( obj1RelativeCuboid.minX > obj0Cuboid.maxX ) return;
		if( obj1RelativeCuboid.minY > obj0Cuboid.maxY ) return;
		if( obj1RelativeCuboid.minZ > obj0Cuboid.maxZ ) return;
		if( obj1RelativeCuboid.maxX < obj0Cuboid.minX ) return;
		if( obj1RelativeCuboid.maxY < obj0Cuboid.minY ) return;
		if( obj1RelativeCuboid.maxZ < obj0Cuboid.minZ ) return;
		
		if( proto0.isInteractive && proto1.isInteractive ) { // Or interactive in some way that we care about!
			// Well there's your collision right there!
			// (unless I add more detailed shapes in the future)
			//const relativePosition = deepFreeze(obj1RelativePosition);
			//const relativeVelocity = deepFreeze(new Vector3D(vel1.x-vel0.x, vel1.y-vel0.y, vel1.z-vel0.z));
			callback(
				room0Ref, rootObj0Ref, proto0, pos0, vel0,
				room1Ref, rootObj1Ref, proto1, pos1, vel1 );
		} else if( proto0.type != PhysicalObjectType.INDIVIDUAL ) {
			throw new Error("Oh no, trying to find tree-tree collisions, omg why");
			/*
			eachSubObject( proto0, pos0, this.game, (subObj, subPos) => {
				this._findCollision2(
					room0Ref, rootObj0Ref, subObj, subPos, vel0,
					room1Ref, rootObj1Ref, proto1  , pos1  , vel1,
					callback );
			}, this);
			*/
		} else if( proto1.type != PhysicalObjectType.INDIVIDUAL ) {
			eachSubObject( proto1, pos1, this.game, (subObj:ProtoObject, statef:number, subPos:Vector3D, orientation:Quaternion) => {
				this._findCollision2(
					room0Ref, rootObj0Ref, proto0  , pos0  , vel0,
					room1Ref, rootObj1Ref, subObj, subPos, vel1,
					callback );
			}, this);
		}
	}
	
	protected _findCollisions( room0Ref:string, obj0Ref:string, obj0:PhysicalObject, room1Ref:string, room1Pos:Vector3D, callback:CollisionCallback ):void {
		const room1 = this.game.rooms[room1Ref];
		const proto0 = this.prototype(obj0);
		for( const obj1Ref in room1.objects ) {
			if( obj1Ref == obj0Ref ) continue;
			
			const obj1 = room1.objects[obj1Ref];
			if( !obj1 ) throw new Error("No such object "+obj1Ref+" in room "+room1Ref);
			const obj1Position = obj1.position;
			//if( !obj1Position ) throw new Error("Object "+obj1Ref+" has no position");
			const obj0Position = obj0.position;
			//if( !obj0Position ) throw new Error("Object "+obj0Ref+" has no position");
			
			const proto1 = this.prototype(obj1);
			
			obj1RelativePosition.set(
				room1Pos.x + obj1Position.x - obj0Position.x,
				room1Pos.y + obj1Position.y - obj0Position.y,
				room1Pos.z + obj1Position.z - obj0Position.z
			);
			displacedCuboid(proto1.physicalBoundingBox, obj1RelativePosition, obj1RelativeCuboid);
						
			const obj0Cuboid = proto0.physicalBoundingBox;
			// Touching at the edge counts as a collision because we'll want to figure friction, etc
			if( obj1RelativeCuboid.minX > obj0Cuboid.maxX ) continue;
			if( obj1RelativeCuboid.minY > obj0Cuboid.maxY ) continue;
			if( obj1RelativeCuboid.minZ > obj0Cuboid.maxZ ) continue;
			if( obj1RelativeCuboid.maxX < obj0Cuboid.minX ) continue;
			if( obj1RelativeCuboid.maxY < obj0Cuboid.minY ) continue;
			if( obj1RelativeCuboid.maxZ < obj0Cuboid.minZ ) continue;
			
			this._findCollision2(
				room0Ref, obj0Ref, proto0, Vector3D.ZERO, obj0.velocity ? obj0.velocity : Vector3D.ZERO,
				room1Ref, obj1Ref, proto1, obj1RelativePosition, obj1.velocity ? obj1.velocity : Vector3D.ZERO,
				callback
			);
		}
	}
	
	protected findCollisions( roomRef:string, objRef:string, callback:CollisionCallback ):void {
		const room:Room = this.game.rooms[roomRef];
		const obj:PhysicalObject = room.objects[objRef];
		this._findCollisions(roomRef, objRef, obj, roomRef, Vector3D.ZERO, callback);
		for( const n in room.neighbors ) {
			const neighbor = room.neighbors[n];
			const nRef = neighbor.roomRef;
			//this._findCollisions(roomRef, objRef, obj, nRef, neighbor.offset, callback);
		}
	}
	
	protected objectUpdated( obj:PhysicalObject, objRef:string ):void {
		let roomRef = objRoomRef(obj);
		if( roomRef ) {
			const oldRoom = this.game.rooms[roomRef];
			if( !oldRoom.bounds.containsVector(obj.position) ) for( const n in oldRoom.neighbors ) {
				const neighbor = oldRoom.neighbors[n];
				displacedCuboid(neighbor.bounds, neighbor.offset, neighborRelativeCuboid);
				const objPos = obj.position;
				//if( !objPos ) throw new Error("Object "+objRef+" has no position");
				if( objPos.x < neighborRelativeCuboid.minX ) continue;
				if( objPos.y < neighborRelativeCuboid.minY ) continue;
				if( objPos.z < neighborRelativeCuboid.minZ ) continue;
				if( objPos.x > neighborRelativeCuboid.maxX ) continue;
				if( objPos.y > neighborRelativeCuboid.maxY ) continue;
				if( objPos.z > neighborRelativeCuboid.maxZ ) continue;
				// ooh, we're in it!
				obj = defreezeItem(oldRoom.objects, objRef, obj);
				obj.position = Vector3D.subtract(objPos, neighbor.offset);
				if( neighbor.roomRef != roomRef ) {
					roomRef = neighbor.roomRef;
					delete oldRoom.objects[objRef];
					const newRoom = this.game.rooms[roomRef];
					newRoom.objects[objRef] = obj;
					setObjRoomRef(obj, roomRef);
				}
				// We found a neighbor; don't need to keep looking.
				// roomRef has been updated.
				break;
			}
		}
		
		if( this.objectIsActive(obj) ) {
			this.activeObjects[objRef] = obj;
		} else {
			delete this.activeObjects[objRef];
		}
	}
	
	public addObject( roomRef:string, obj:PhysicalObject, objId:string=newUuidRef() ):string {
		this._game.rooms[roomRef].objects[objId] = obj;
		setObjRoomRef(obj, roomRef);
		this.objectUpdated(obj, objId);
		return objId;
	}
	
	protected getRoomObject( roomRef:string, objRef:string ):PhysicalObject {
		const room = this.game.rooms[roomRef];
		if( room == null ) throw new Error("No such room as '"+roomRef+"'");
		const obj = room.objects[objRef];
		if( obj == null ) throw new Error("No such object as '"+objRef+"' in room '"+roomRef+"'");
		return obj;
	}
	
	// New, better!  (maybe)
	/**
	 * Return true if this should stop obj0 from moving for this tick
	 */
	protected handleCollision(
		room0Ref:string, rootObj0Ref:string, proto0:ProtoObject, pos0:Vector3D, vel0:Vector3D,
		room1Ref:string, rootObj1Ref:string, proto1:ProtoObject, pos1:Vector3D, vel1:Vector3D
	):boolean {
		if( vel0 == null ) return false; // let's say for now that null velocity means immobile
		if( !proto0.isRigid || !proto1.isRigid ) return false;
		
		const relPos = Vector3D.subtract(pos1, pos0);
		const otherBbRel = displacedCuboid(proto1.physicalBoundingBox, relPos, new Cuboid);
		//console.log("Collision; relative position = "+vectorStr(relPos), "otherBbRel", otherBbRel);
		
		// TODO: bouncing spheres?  Or other odd shapes?  Calculate different!
		
		var overlapBottom = 0, overlapTop = 0, overlapRight = 0, overlapLeft = 0;
		
		// Bouncing is based on object's center line(s) intersecting the other object.
		// This isn't exactly right but works okay for 'regularish shapes'
		if( otherBbRel.minX <= 0 && otherBbRel.maxX >= 0 ) {
			if( otherBbRel.minY > 0 && proto0.physicalBoundingBox.maxY > otherBbRel.minY ) {
				overlapBottom = Math.max(proto0.physicalBoundingBox.maxY - otherBbRel.minY);
			}
			if( otherBbRel.maxY < 0 && proto0.physicalBoundingBox.minY < otherBbRel.maxY ) {
				overlapTop = Math.max(overlapTop, otherBbRel.maxY - proto0.physicalBoundingBox.minY);
			}
		}
		if( otherBbRel.minY <= 0 && otherBbRel.maxY >= 0 ) {
			if( otherBbRel.minX > 0 && proto0.physicalBoundingBox.maxX > otherBbRel.minX ) {
				overlapRight = Math.max(overlapRight, proto0.physicalBoundingBox.maxX - otherBbRel.minX);
			}
			if( otherBbRel.maxX < 0 && proto0.physicalBoundingBox.minX < otherBbRel.maxX ) {
				overlapLeft = Math.max(overlapLeft, otherBbRel.maxX - proto0.physicalBoundingBox.minX);
			}
		}
		
		//console.log("bounce (pre-cancel)", bounceUp, bounceDown, bounceLeft, bounceRight);
		
		// Fully inside?  Then don't try to move it at all, I guess.
		if( overlapBottom && overlapTop  ) overlapBottom = overlapTop  = 0;
		if( overlapRight  && overlapLeft ) overlapRight  = overlapLeft = 0;
		
		if( !overlapBottom && !overlapTop && !overlapRight && !overlapLeft ) return false; // Save ourselves some work
		
		//console.log("bounce (post-cancel)", bounceUp, bounceDown, bounceLeft, bounceRight);
		
		const obj0 = this.getRoomObject(room0Ref,rootObj0Ref);
		const obj1 = this.getRoomObject(room1Ref,rootObj1Ref);
		
		const obj0Mass = coalesce2(proto0.mass, Infinity);
		if( obj0Mass == Infinity ) throw new Error("Moving object has null/infinite mass");
		const obj1Mass = coalesce2(proto1.mass, Infinity);
		const obj1FakeMass = obj1Mass == Infinity ? proto0.mass*1000 : proto1.mass;
		const totalMass = obj0Mass + obj1FakeMass;
		
		const cmX:number = (pos0.x*obj0Mass + pos1.x*obj1FakeMass)/totalMass;
		const cmY:number = (pos0.y*obj0Mass + pos1.y*obj1FakeMass)/totalMass;
		const cmZ:number = (pos0.z*obj0Mass + pos1.z*obj1FakeMass)/totalMass;
		
		const displaceX = overlapLeft - overlapRight;
		const displaceY = overlapTop  - overlapBottom;
		
		const displace0Factor = 1; // 1 means only display obj0, which maybe makes things easier.
		//const displace1Factor = 1; // obj1Mass == Infinity ? 1 : obj1Mass/totalMass;
		const displace1Factor = 1 - displace0Factor; // i.e. zero
		
		let updatedObj0 = false;
		let updatedObj1 = false;
				
		if( obj0Mass != Infinity && displace0Factor > 0 ) {
			obj0.position = new Vector3D(
				obj0.position.x + displaceX * displace0Factor,
				obj0.position.y + displaceY * displace0Factor,
				obj0.position.z
			);
			updatedObj0 = true;
		}
		/*
		if( obj1.position && obj1Mass != Infinity && displace1Factor > 0 ) {
			obj1.position = new Vector3D(
				obj1.position.x - displaceX * displace1Factor,
				obj1.position.y - displaceY * displace1Factor,
				obj1.position.z
			);
			this.fixRoomAssignment( room1Ref, rootObj1Ref );
		}
		*/
		
		// TODO: friction!!!!
		
		//console.log("new position", vectorStr(obj0.position));
		
		//const relVel = Vector3D.subtract(vel1, vel0);
		
		// Velocity of the center of mass = sum of velocities weighted by mass
		const totalVx:number = (vel0.x*obj0Mass + vel1.x*obj1FakeMass)/totalMass;
		const totalVy:number = (vel0.y*obj0Mass + vel1.y*obj1FakeMass)/totalMass;
		const totalVz:number = (vel0.z*obj0Mass + vel1.z*obj1FakeMass)/totalMass;
		
		// Relative (to obj0's) velocity of the center of mass
		
		const bounciness = coalesce2(proto0.bounciness, 0.5)*coalesce2(proto1.bounciness, 0.5);
		
		if( obj0.velocity ) {
			const relTotal0Vx = totalVx - vel0.x;
			const relTotal0Vy = totalVy - vel0.y;
			const relTotal0Vz = totalVz - vel0.z;
			obj0.velocity = new Vector3D(
				(overlapRight||overlapLeft) ? totalVx + relTotal0Vx*bounciness : vel0.x,
				(overlapBottom  ||overlapTop ) ? totalVy + relTotal0Vy*bounciness : vel0.y,
				vel0.z
			);
			updatedObj0 = true;
		}
		if( obj1.velocity ) {
			const relTotal1Vx = totalVx - vel1.x;
			const relTotal1Vy = totalVy - vel1.y;
			const relTotal1Vz = totalVz - vel1.z;
			obj1.velocity = new Vector3D(
				(overlapRight||overlapLeft) ? totalVx + relTotal1Vx*bounciness : vel1.x,
				(overlapBottom  ||overlapTop ) ? totalVy + relTotal1Vy*bounciness : vel1.y,
				vel1.z
			);
			updatedObj1 = true;
		}

		if( updatedObj0 ) this.objectUpdated( obj0, rootObj0Ref );
		if( updatedObj1 ) this.objectUpdated( obj1, rootObj1Ref );
		
		return updatedObj0;
	}
	
	public tick(interval:number):void {
		const rooms = this.game.rooms;
		
		for( const o in this.activeObjects ) {
			let obj = this.activeObjects[o];
			const room = rooms[objRoomRef(obj)];
			const proto = this.prototype(obj);
			
			if( proto.isAffectedByGravity ) {
				obj = defreezeItem<PhysicalObject>(room.objects, o, obj);
				const ov = obj.velocity ? obj.velocity : Vector3D.ZERO;
				obj.velocity = new Vector3D( ov.x, ov.y, ov.z );
				Vector3D.accumulate( this.gravityVector, obj.velocity, interval );
			}
			
			{
				let ov = obj.velocity;
				if( ov && !ov.isZero ) {
					obj = defreezeItem<PhysicalObject>(room.objects, o, obj);
					ov = obj.velocity = fitVectorToBoundingBox( ov, proto.physicalBoundingBox, 10/interval );
					const invStepCount = vectorToBoundingBoxFitScale( ov, proto.physicalBoundingBox, 0.875/interval );
					const stepCount = Math.ceil( 1 / invStepCount );
					//if( stepCount > 10 ) console.log("Lots of steps! "+stepCount);
					const stepSize = interval/stepCount;
					//if(stepSize > 1) console.log("Oh things getting fast.  Using "+stepCount+" steps, now.  Step size: "+stepSize);
					let foundCollisions:boolean = false;
					// Step forward until we hit something
					for( let s=0; s < stepCount && !foundCollisions; ++s ) {
						ov = obj.velocity;
						
						{
							const op = obj.position;
							//if( !op ) throw new Error("Object "+o+" has no position");
							obj.position = new Vector3D( op.x + ov.x*stepSize, op.y+ov.y*stepSize, op.z+ov.z*stepSize );
							this.objectUpdated(obj, o);
						}
							
						this.findCollisions(objRoomRef(obj), o, (
							cRoom0Ref:string, cRootObj0Ref:string, cProto0:ProtoObject, cPos0:Vector3D, cVel0:Vector3D,
							cRoom1Ref:string, cRootObj1Ref:string, cProto1:ProtoObject, cPos1:Vector3D, cVel1:Vector3D
						) => {
							if( this.handleCollision(
								cRoom0Ref, cRootObj0Ref, cProto0, cPos0, cVel0,
								cRoom1Ref, cRootObj1Ref, cProto1, cPos1, cVel1
							) ) foundCollisions = true; // Do we even really need this?  We can look at new velocity.
						});
					}
				}
			}
		}
		
		this.game.time += interval;
	}
}
