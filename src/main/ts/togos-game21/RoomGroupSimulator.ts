import ProceduralShape from './ProceduralShape';
import Rectangle from './Rectangle';
import Cuboid from './Cuboid';
import Vector3D from './Vector3D';
import KeyedList from './KeyedList';
import { newUuidRef } from './DemoWorldGenerator';
import { PhysicalObjectType, PhysicalObject, TileTree, Room, Game, HUNIT_CUBE } from './world';
import { eachSubObject } from './worldutil';
import { deepFreeze, isDeepFrozen, thaw } from './DeepFreezer';

function coalesce<T>(v:T, v1:T):T {
	if( v != null ) return v;
	return v1;
}

function defreezeItem<T>( c:any, k:any, o?:T ):T {
	if( o == null ) o = c[k];
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
	room0Ref:string, rootObj0Ref:string, obj0:PhysicalObject, pos0:Vector3D, vel0:Vector3D,
	room1Ref:string, rootObj1Ref:string, obj1:PhysicalObject, pos1:Vector3D, vel1:Vector3D
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
	
	protected objectIsActive( obj:PhysicalObject ) {
		if( obj.velocity != null && !obj.velocity.isZero ) return true;
		if( obj.isAffectedByGravity ) return true;
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
		room0Ref:string, rootObj0Ref:string, obj0:PhysicalObject, pos0:Vector3D, vel0:Vector3D,
		room1Ref:string, rootObj1Ref:string, obj1:PhysicalObject, pos1:Vector3D, vel1:Vector3D,
		callback:CollisionCallback
	):void {
		obj1RelativePosition.set(
			pos1.x - pos0.x,
			pos1.y - pos0.y,
			pos1.z - pos0.z
		);
		displacedCuboid(obj1.physicalBoundingBox, obj1RelativePosition, obj1RelativeCuboid);
		
		const obj0Cuboid = obj0.physicalBoundingBox;
		// Touching at the edge counts as a collision because we'll want to figure friction, etc
		if( obj1RelativeCuboid.minX > obj0Cuboid.maxX ) return;
		if( obj1RelativeCuboid.minY > obj0Cuboid.maxY ) return;
		if( obj1RelativeCuboid.minZ > obj0Cuboid.maxZ ) return;
		if( obj1RelativeCuboid.maxX < obj0Cuboid.minX ) return;
		if( obj1RelativeCuboid.maxY < obj0Cuboid.minY ) return;
		if( obj1RelativeCuboid.maxZ < obj0Cuboid.minZ ) return;
		
		if( obj0.isInteractive && obj1.isInteractive ) { // Or interactive in some way that we care about!
			// Well there's your collision right there!
			// (unless I add more detailed shapes in the future)
			//const relativePosition = deepFreeze(obj1RelativePosition);
			//const relativeVelocity = deepFreeze(new Vector3D(vel1.x-vel0.x, vel1.y-vel0.y, vel1.z-vel0.z));
			callback(
				room0Ref, rootObj0Ref, obj0, pos0, vel0,
				room1Ref, rootObj1Ref, obj1, pos1, vel1 );
		} else if( obj0.type != PhysicalObjectType.INDIVIDUAL ) {
			if(true || true) throw new Error("Oh no, trying to find tree-tree collisions, omg why");
			eachSubObject( obj0, pos0, this.game, (subObj, subPos) => {
				this._findCollision2(
					room0Ref, rootObj0Ref, subObj, subPos, vel0,
					room1Ref, rootObj1Ref, obj1  , pos1  , vel1,
					callback );
			}, this);
		} else if( obj1.type != PhysicalObjectType.INDIVIDUAL ) {
			eachSubObject( obj1, pos1, this.game, (subObj, subPos) => {
				this._findCollision2(
					room0Ref, rootObj0Ref, obj0  , pos0  , vel0,
					room1Ref, rootObj1Ref, subObj, subPos, vel1,
					callback );
			}, this);
		}
	}
	
	protected _findCollisions( room0Ref:string, obj0Ref:string, obj0:PhysicalObject, room1Ref:string, room1Pos:Vector3D, callback:CollisionCallback ):void {
		const room1 = this.game.rooms[room1Ref];
		for( const obj1Ref in room1.objects ) {
			if( obj1Ref == obj0Ref ) continue;
			
			const obj1 = room1.objects[obj1Ref];
			
			const obj0Position = obj0.position;
			obj1RelativePosition.set(
				room1Pos.x + obj1.position.x - obj0Position.x,
				room1Pos.y + obj1.position.y - obj0Position.y,
				room1Pos.z + obj1.position.z - obj0Position.z
			);
			displacedCuboid(obj1.physicalBoundingBox, obj1RelativePosition, obj1RelativeCuboid);
						
			const obj0Cuboid = obj0.physicalBoundingBox;
			// Touching at the edge counts as a collision because we'll want to figure friction, etc
			if( obj1RelativeCuboid.minX > obj0Cuboid.maxX ) continue;
			if( obj1RelativeCuboid.minY > obj0Cuboid.maxY ) continue;
			if( obj1RelativeCuboid.minZ > obj0Cuboid.maxZ ) continue;
			if( obj1RelativeCuboid.maxX < obj0Cuboid.minX ) continue;
			if( obj1RelativeCuboid.maxY < obj0Cuboid.minY ) continue;
			if( obj1RelativeCuboid.maxZ < obj0Cuboid.minZ ) continue;
			
			this._findCollision2(
				room0Ref, obj0Ref, obj0, Vector3D.ZERO, obj0.velocity ? obj0.velocity : Vector3D.ZERO,
				room1Ref, obj1Ref, obj1, obj1RelativePosition, obj1.velocity ? obj1.velocity : Vector3D.ZERO,
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
				if( obj.position.x < neighborRelativeCuboid.minX ) continue;
				if( obj.position.y < neighborRelativeCuboid.minY ) continue;
				if( obj.position.z < neighborRelativeCuboid.minZ ) continue;
				if( obj.position.x > neighborRelativeCuboid.maxX ) continue;
				if( obj.position.y > neighborRelativeCuboid.maxY ) continue;
				if( obj.position.z > neighborRelativeCuboid.maxZ ) continue;
				// ooh, we're in it!
				obj = defreezeItem(oldRoom.objects, objRef, obj);
				obj.position = Vector3D.subtract(obj.position, neighbor.offset);
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
	
	// New, better!  (maybe)
	/**
	 * Return true if this should stop obj0 from moving for this tick
	 */
	protected handleCollision(
		room0Ref:string, rootObj0Ref:string, obj0:PhysicalObject, pos0:Vector3D, vel0:Vector3D,
		room1Ref:string, rootObj1Ref:string, obj1:PhysicalObject, pos1:Vector3D, vel1:Vector3D
	):boolean {
		if( obj0.velocity == null ) return false; // let's say for now that null velocity means immobile
		if( !obj0.isRigid || !obj1.isRigid ) return false;
		
		const relPos = Vector3D.subtract(pos1, pos0);
		const otherBbRel = displacedCuboid(obj1.physicalBoundingBox, relPos, new Cuboid);
		//console.log("Collision; relative position = "+vectorStr(relPos), "otherBbRel", otherBbRel);
		
		// TODO: bouncing spheres?  Or other odd shapes?  Calculate different!
		
		var overlapBottom = 0, overlapTop = 0, overlapRight = 0, overlapLeft = 0;
		
		// Bouncing is based on object's center line(s) intersecting the other object.
		// This isn't exactly right but works okay for 'regularish shapes'
		if( otherBbRel.minX <= 0 && otherBbRel.maxX >= 0 ) {
			if( otherBbRel.minY > 0 && obj0.physicalBoundingBox.maxY > otherBbRel.minY ) {
				overlapBottom = Math.max(obj0.physicalBoundingBox.maxY - otherBbRel.minY);
			}
			if( otherBbRel.maxY < 0 && obj0.physicalBoundingBox.minY < otherBbRel.maxY ) {
				overlapTop = Math.max(overlapTop, otherBbRel.maxY - obj0.physicalBoundingBox.minY);
			}
		}
		if( otherBbRel.minY <= 0 && otherBbRel.maxY >= 0 ) {
			if( otherBbRel.minX > 0 && obj0.physicalBoundingBox.maxX > otherBbRel.minX ) {
				overlapRight = Math.max(overlapRight, obj0.physicalBoundingBox.maxX - otherBbRel.minX);
			}
			if( otherBbRel.maxX < 0 && obj0.physicalBoundingBox.minX < otherBbRel.maxX ) {
				overlapLeft = Math.max(overlapLeft, otherBbRel.maxX - obj0.physicalBoundingBox.minX);
			}
		}
		
		//console.log("bounce (pre-cancel)", bounceUp, bounceDown, bounceLeft, bounceRight);
		
		// Fully inside?  Then don't try to move it at all, I guess.
		if( overlapBottom && overlapTop  ) overlapBottom = overlapTop  = 0;
		if( overlapRight  && overlapLeft ) overlapRight  = overlapLeft = 0;
		
		if( !overlapBottom && !overlapTop && !overlapRight && !overlapLeft ) return false; // Save ourselves some work
		
		//console.log("bounce (post-cancel)", bounceUp, bounceDown, bounceLeft, bounceRight);
		
		const obj0Mass = coalesce(obj0.mass, Infinity);
		if( obj0Mass == Infinity ) throw new Error("Moving object has null/infinite mass");
		const obj1Mass = obj1.velocity == null ? Infinity : coalesce(obj1.mass, Infinity);
		const obj1FakeMass = obj1Mass == Infinity ? obj0.mass*1000 : obj1.mass;
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
		
		if( obj0.position && obj0Mass != Infinity && displace0Factor > 0 ) {
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
		
		const bounciness = coalesce(obj0.bounciness, 0.5)*coalesce(obj1.bounciness, 0.5);
		
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
			
			if( obj.isAffectedByGravity ) {
				obj = defreezeItem<PhysicalObject>(room.objects, o, obj);
				const ov = obj.velocity ? obj.velocity : Vector3D.ZERO;
				obj.velocity = new Vector3D( ov.x, ov.y, ov.z );
				Vector3D.accumulate( this.gravityVector, obj.velocity, interval );
			}
			
			{
				let ov = obj.velocity;
				if( ov && !ov.isZero ) {
					obj = defreezeItem<PhysicalObject>(room.objects, o, obj);
					ov = obj.velocity = fitVectorToBoundingBox( ov, obj.physicalBoundingBox, 10/interval );
					const invStepCount = vectorToBoundingBoxFitScale( ov, obj.physicalBoundingBox, 0.875/interval );
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
							obj.position = new Vector3D( op.x + ov.x*stepSize, op.y+ov.y*stepSize, op.z+ov.z*stepSize );
							this.objectUpdated(obj, o);
						}
							
						this.findCollisions(objRoomRef(obj), o, (
							cRoom0Ref:string, cRootObj0Ref:string, cObj0:PhysicalObject, cPos0:Vector3D, cVel0:Vector3D,
							cRoom1Ref:string, cRootObj1Ref:string, cObj1:PhysicalObject, cPos1:Vector3D, cVel1:Vector3D
						) => {
							if( this.handleCollision(
								cRoom0Ref, cRootObj0Ref, cObj0, cPos0, cVel0,
								cRoom1Ref, cRootObj1Ref, cObj1, cPos1, cVel1
							) ) foundCollisions = true; // Do we even really need this?  We can look at new velocity.
						});
					}
				}
			}
		}
		
		this.game.time += interval;
	}
}
