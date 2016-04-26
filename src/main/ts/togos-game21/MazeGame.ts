import ShapeSheetUtil from './ShapeSheetUtil';
import TransformationMatrix3D from './TransformationMatrix3D';
import ObjectVisual, { VisualBasisType } from './ObjectVisual';
import ProceduralShape from './ProceduralShape';
import Rectangle from './Rectangle';
import Cuboid from './Cuboid';
import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import KeyedList from './KeyedList';
import { OnAnimationEnd } from './Animation';
import { DEFAULT_MATERIALS, IDENTITY_MATERIAL_REMAP } from './materials';
import CanvasWorldView from './CanvasWorldView';
import DemoWorldGenerator, { newUuidRef, simpleObjectVisualShape } from './DemoWorldGenerator';
import { PhysicalObjectType, PhysicalObject, TileTree, Room, Game, HUNIT_CUBE } from './world';
import { deepFreeze, isDeepFrozen, thaw } from './DeepFreezer';

function defreezeItem<T>( c:any, k:any, o?:any ):T {
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

class Collision {
	constructor(
		public room0Ref:string, public rootObj0Ref:string, public obj0:PhysicalObject, public pos0:Vector3D, public vel0:Vector3D,
		public room1Ref:string, public rootObj1Ref:string, public obj1:PhysicalObject, public pos1:Vector3D, public vel1:Vector3D
	) { }
	
	public get key() {
		return this.rootObj0Ref + "-" + this.rootObj1Ref + ":" + this.pos0.x + "," + this.pos0.y + "," + this.pos0.z;
	}
	
	public reverse(dest:Collision):Collision {
		dest.room0Ref = this.room1Ref; dest.rootObj0Ref = this.rootObj1Ref; dest.obj0 = this.obj1; dest.pos0 = this.pos1; dest.vel0 = this.vel1;
		dest.room1Ref = this.room0Ref; dest.rootObj1Ref = this.rootObj0Ref; dest.obj1 = this.obj0; dest.pos1 = this.pos0; dest.vel1 = this.vel0;
		return dest;
	}
	
	/*
	public getAverageMomentum( dest:Vector3D ) {
		if( this.obj0.velocity ) Vector3D.accumulate( this.obj0.velocity, dest, 1 );
		if( this.obj1.velocity ) Vector3D.accumulate( this.obj1.velocity, dest, 1 );
	}
	*/
	
	/*
	 Unneeded since we do the swapping earlier
	public static create(
		o0RoomRef:string, o0ObjectRef:string,
		o1RoomRef:string,	o1ObjectRef:string,
		displacement:Vector3D
	):Collision {
		if( o0ObjectRef > o1ObjectRef ) {
			return new Collision( o1RoomRef, o1ObjectRef, o0RoomRef, o0ObjectRef, displacement.scale(-1) );
		} else {
			return new Collision( o0RoomRef, o0ObjectRef, o1RoomRef, o1ObjectRef, displacement );
		}
	}
	*/
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

const obj1RelativePosition = new Vector3D;
const objBRelativePosition = new Vector3D;
const obj1RelativeCuboid = new Cuboid;
const posBuffer0 = new Vector3D;
const momentumBuffer = new Vector3D;
const reverseCollision = new Collision(null,null,null,null,null,null,null,null,null,null);

class WorldSimulator {
	public time = 0;
	public gravityVector:Vector3D = Vector3D.ZERO;
	
	constructor(public game:Game) { }
	
	protected eachSubObject( obj:PhysicalObject, pos:Vector3D, callback:(subObj:PhysicalObject, pos:Vector3D)=>void ) {
		if( obj.type == PhysicalObjectType.INDIVIDUAL ) {
			callback(obj, pos);
		} else if( obj.type == PhysicalObjectType.TILE_TREE ) {
			const tt:TileTree = <TileTree>obj;
			const tilePaletteIndexes = tt.childObjectIndexes;
			const tilePalette = this.game.tilePalettes[tt.childObjectPaletteRef];
			const objectPrototypes = this.game.objectPrototypes;
			const xd = tt.tilingBoundingBox.width/tt.xDivisions;
			const yd = tt.tilingBoundingBox.height/tt.yDivisions;
			const zd = tt.tilingBoundingBox.depth/tt.zDivisions;
			const x0 = pos.x - tt.tilingBoundingBox.width/2  + xd/2;
			const y0 = pos.y - tt.tilingBoundingBox.height/2 + yd/2;
			const z0 = pos.z - tt.tilingBoundingBox.depth/2  + zd/2;
			for( let i=0, z=0; z < tt.zDivisions; ++z ) for( let y=0; y < tt.yDivisions; ++y ) for( let x=0; x < tt.xDivisions; ++x, ++i ) {
				const childId = tilePalette[tilePaletteIndexes[i]];
				if( childId != null ) {
					const child = objectPrototypes[childId];
					callback( child, posBuffer0.set(x0+x*xd, y0+y*yd, z0+z*zd) );
				}
			}
		}
	}
	
	protected _findCollision2(
		room0Ref:string, rootObj0Ref:string, obj0:PhysicalObject, pos0:Vector3D, vel0:Vector3D,
		room1Ref:string, rootObj1Ref:string, obj1:PhysicalObject, pos1:Vector3D, vel1:Vector3D,
		dest:KeyedList<Collision>
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
		
		if( obj0.isRigid && obj1.isRigid ) { // Or interactive in some way that we care about!
			// Well there's your collision right there!
			// (unless I add more detailed shapes in the future)
			//const relativePosition = deepFreeze(obj1RelativePosition);
			//const relativeVelocity = deepFreeze(new Vector3D(vel1.x-vel0.x, vel1.y-vel0.y, vel1.z-vel0.z));
			const collision = new Collision(
				room0Ref, rootObj0Ref, obj0, deepFreeze(pos0), deepFreeze(vel0),
				room1Ref, rootObj1Ref, obj1, deepFreeze(pos1), deepFreeze(vel1) );
			const key = collision.key;
			dest[key] = collision;
			return;
		} else if( obj0.type != PhysicalObjectType.INDIVIDUAL ) {
			this.eachSubObject( obj0, pos0, (subObj, subPos) => {
				this._findCollision2(
					room0Ref, rootObj0Ref, subObj, subPos, vel0,
					room1Ref, rootObj1Ref, obj1, pos1, vel1, dest );
			});
		} else if( obj1.type != PhysicalObjectType.INDIVIDUAL ) {
			this.eachSubObject( obj1, pos1, (subObj, subPos) => {
				this._findCollision2(
					room0Ref, rootObj0Ref, obj0, pos0, vel0,
					room1Ref, rootObj1Ref, subObj, subPos, vel1, dest );
			});
		}
	}
	
	protected _findCollisions( room0Ref:string, obj0Ref:string, obj0:PhysicalObject, room1Ref:string, room1Pos:Vector3D, dest:KeyedList<Collision> ) {
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
			
			// Order objects by ID so we only count collisions once
			let roomARef:string, objARef:string, objA:PhysicalObject, roomBRef:string, objBRef:string, objB:PhysicalObject;
			let dScale:number;
			if( obj0Ref < obj1Ref ) {
				roomARef = room0Ref;	objARef = obj0Ref; objA = obj0;
				roomBRef = room1Ref;	objBRef = obj1Ref; objB = obj1;
				objBRelativePosition.set( +obj1RelativePosition.x, +obj1RelativePosition.y, +obj1RelativePosition.z );
			} else {
				roomARef = room1Ref;	objARef = obj1Ref; objA = obj1;
				roomBRef = room0Ref;	objBRef = obj0Ref; objB = obj0;
				objBRelativePosition.set( -obj1RelativePosition.x, -obj1RelativePosition.y, -obj1RelativePosition.z );
			}
			
			this._findCollision2(
				roomARef, objARef, objA, Vector3D.ZERO       , objA.velocity ? objA.velocity : Vector3D.ZERO,
				roomBRef, objBRef, objB, objBRelativePosition, objB.velocity ? objB.velocity : Vector3D.ZERO,
				dest
			);
		}
	}
	
	protected findCollisions( roomRef:string, objRef:string, dest:KeyedList<Collision> ):KeyedList<Collision> {
		const room:Room = this.game.rooms[roomRef];
		const obj:PhysicalObject = room.objects[objRef];
		this._findCollisions(roomRef, objRef, obj, roomRef, Vector3D.ZERO, dest);
		for( const n in room.neighbors ) {
			const neighbor = room.neighbors[n];
			const nRef = neighbor.roomId;
			this._findCollisions(roomRef, objRef, obj, nRef, neighbor.offset, dest);
		}
		return dest;
	}
	
	protected handleCollisionSide(collision:Collision):void {
		const obj0 = collision.obj0;
		if( obj0.velocity == null ) return; // let's say for now that null velocity means immobile
		
		console.log("-- Collision "+objectName(collision.obj0, collision.rootObj0Ref)+ " vs "+objectName(collision.obj1, collision.rootObj1Ref), collision);
		
		const obj1 = collision.obj1;
		const relPos = Vector3D.subtract(collision.pos1, collision.pos0);
		const otherBbRel = displacedCuboid(obj1.physicalBoundingBox, relPos, new Cuboid);

		// TODO: bouncing spheres?  Or other odd shapes?  Calculate different!
		
		var bounceUp = 0, bounceDown = 0, bounceLeft = 0, bounceRight = 0;
		
		// Bouncing is based on object's center line(s) intersecting the other object							
		if( otherBbRel.minX <= 0 && otherBbRel.maxX >= 0 ) {
			if( otherBbRel.minY > 0 && obj0.physicalBoundingBox.maxY > otherBbRel.minY ) {
				bounceUp = Math.max(obj0.physicalBoundingBox.maxY - otherBbRel.minY);
			}
			if( otherBbRel.maxY < 0 && obj0.physicalBoundingBox.minY < otherBbRel.maxY ) {
				bounceDown = Math.max(bounceDown, otherBbRel.maxY - obj0.physicalBoundingBox.minY);
			}
		}
		if( otherBbRel.minY <= 0 && otherBbRel.maxY >= 0 ) {
			if( otherBbRel.minX > 0 && obj0.physicalBoundingBox.maxX > otherBbRel.minX ) {
				bounceLeft = Math.max(bounceLeft, obj0.physicalBoundingBox.maxX - otherBbRel.minX);
			}
			if( otherBbRel.maxX < 0 && obj0.physicalBoundingBox.minX < otherBbRel.maxX ) {
				bounceRight = Math.max(bounceRight, otherBbRel.maxX - obj0.physicalBoundingBox.minX);
			}
		}
		
		console.log("bounce (pre-cancel)", bounceUp, bounceDown, bounceLeft, bounceRight);
		
		if( bounceUp   && bounceDown  ) bounceUp   = bounceDown  = 0;
		if( bounceLeft && bounceRight ) bounceLeft = bounceRight = 0;

		console.log("bounce (post-cancel)", bounceUp, bounceDown, bounceLeft, bounceRight);
		
		obj0.position = new Vector3D(
			obj0.position.x + bounceRight - bounceLeft,
			obj0.position.y + bounceDown - bounceUp,
			obj0.position.z
		);
		
		console.log("new position", vectorStr(obj0.position));
		
		if( !bounceUp && !bounceDown && !bounceLeft && !bounceRight ) return; // Save ourselves some work
		
		const obj0Vel = collision.vel0;
		const obj1Mass = obj1.mass == null || obj1.mass == Infinity ? obj0.mass*1000 : obj1.mass;
		const relVel = Vector3D.subtract(collision.vel1, collision.vel0);
		const obj0Mass = obj0.mass; // assuming non-zero for moving stuffs!
		if( obj0Mass == null || obj0Mass == Infinity ) throw new Error("Moving object has null/infinite velocity");
		const totalMass = obj0Mass + obj1Mass;
		
		// Velocity of the center of mass = sum of velocities weighted by mass
		const totalVx:number = ((obj0Vel.x*obj0Mass) + (obj0Vel.x + relVel.x)*obj1Mass)/totalMass;
		const totalVy:number = ((obj0Vel.y*obj0Mass) + (obj0Vel.y + relVel.y)*obj1Mass)/totalMass;
		const totalVz:number = ((obj0Vel.z*obj0Mass) + (obj0Vel.z + relVel.z)*obj1Mass)/totalMass;
		
		// Relative (to obj0's) velocity of the center of mass
		const relTotalVx = totalVx - obj0Vel.x;
		const relTotalVy = totalVy - obj0Vel.y;
		const relTotalVz = totalVz - obj0Vel.z;
		
		console.log("total v", vectorStr(new Vector3D(totalVx, totalVy, totalVz)));
		console.log("relative total v", vectorStr(new Vector3D(relTotalVx, relTotalVy, relTotalVz)));
		
		// const bounceFactor = obj1Mass / totalMass;
		
		//const relTotalVelMagX = Math.abs(relTotalVx);
		//const relTotalVelMagY = Math.abs(relTotalVy);
		// TODO: Fix object's room again here if necessary
		obj0.velocity = new Vector3D(
			(bounceLeft||bounceRight) ? totalVx + relTotalVx : obj0Vel.x,
			(bounceUp  ||bounceDown ) ? totalVy + relTotalVy : obj0Vel.y,
			obj0Vel.z
		);
		
		console.log("new velocity", vectorStr(obj0.velocity));
	}
	
	public tick(interval:number):void {
		const rooms = this.game.rooms;
		const allCollisions:KeyedList<Collision> = {};
		
		for( let r in rooms ) {
			let room = defreezeItem<Room>(rooms, r);
			
			for( let o in room.objects ) {
				let obj = room.objects[o];
				
				//const G = 9.8;
				
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
						let op = obj.position;
						ov = obj.velocity = fitVectorToBoundingBox( ov, obj.physicalBoundingBox, 100 );
						const invStepCount = vectorToBoundingBoxFitScale( ov, obj.physicalBoundingBox, 0.875 );
						const stepCount = Math.ceil( 1 / invStepCount );
						const stepSize = interval/stepCount;
						if(stepSize > 1) console.log("Oh things getting fast.  Using "+stepCount+" steps, now.  Step size: "+stepSize);
						let foundCollisions:boolean = false;
						// Step forward until we hit something
						for( let s=0; s < stepCount && !foundCollisions; ++s ) {
							obj.position = op = new Vector3D( op.x + ov.x*stepSize, op.y+ov.y*stepSize, op.z+ov.z*stepSize );
						
							const collisions:KeyedList<Collision> = {};
							this.findCollisions(r, o, collisions);
							// TODO: only stop on rigid collisions; otherwise just add them to the list
							for( let c in collisions ) {
								allCollisions[c] = collisions[c];
								foundCollisions = true;
							}
						}
						
						obj.position = op;
					}
				}
			}
		}
		
		for( const c in allCollisions ) {
			const collision = allCollisions[c];
			
			console.log("-----------------")
			this.handleCollisionSide(collision);
			this.handleCollisionSide(collision.reverse(reverseCollision));
		}
		
		this.game.time += interval;
	}
}

class PlayerSpecs {
	maxWalkSpeed:number;
}

class PlayerBrain {
	desiredMoveDirection:number; // Angle, in degrees
	desiredMoveSpeed:number; // How fast he wants to move
}

class KeyWatcher {
	protected keysDown:KeyedList<boolean> = {};
	protected onChange:(ev:KeyboardEvent, kw:KeyWatcher)=>void;
	
	constructor( onChange:(ev:KeyboardEvent, kw:KeyWatcher)=>void ) {
		this.onChange = onChange;
	}
	
	protected update(ev:KeyboardEvent) {
		this.onChange(ev, this);
	}
	
	public register() {
		window.addEventListener('keydown', (ev:KeyboardEvent) => {
			this.keysDown[ev.keyCode] = true;
			this.update(ev);
		});
		window.addEventListener('keyup', (ev:KeyboardEvent) => {
			this.keysDown[ev.keyCode] = false;
			this.update(ev);
		});
	}
	
	public anyDown( keyCodes:number[] ) {
		for( let i in keyCodes ) {
			if( this.keysDown[keyCodes[i]] ) return true;
		}
		return false;
	}
}

export default class MazeGame {
	protected _game:Game;
	public worldView:CanvasWorldView;
	public initUi(canvas:HTMLCanvasElement) {
		this.worldView = new CanvasWorldView();
		this.worldView.initUi(canvas);
		this.worldView.game = this._game;
	}
	
	get game():Game { return this._game; }
	set game(g:Game) {
		this._game = g;
		if( this.worldView ) this.worldView.game = g;
	}
	
	public playerRef:string;
	
	protected findPlayer() {
		for( let r in this._game.rooms ) {
			const room = this._game.rooms[r];
			if( room.objects[this.playerRef] ) {
				return room.objects[this.playerRef];
			}
		}
		return null;
	}
	
	public runDemo() {
		const playerRef = this.playerRef = newUuidRef();
		
		const game = this.game = new DemoWorldGenerator().makeCrappyGame();
		const sim = new WorldSimulator(game);
		let roomId:string;
		for( roomId in game.rooms ); // Just find one; whatever.
		// Put player in it!
		
		const playerVisualRef = newUuidRef();
		game.objectVisuals[playerVisualRef] = {
			materialMap: DEFAULT_MATERIALS, // TODO: Make him blue or something
			maVisual: simpleObjectVisualShape( (ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D ) => {
				ssu.plottedMaterialIndexFunction = () => 4;
				const origin:Vector3D = xf.multiplyVector(Vector3D.ZERO);
				ssu.plotSphere(origin.x, origin.y, origin.z, xf.scale/2);
			})
		};
		
		const playerBb:Cuboid = new Cuboid(-0.5,-0.5,-0.5,0.5,0.5,0.5);
		
		game.rooms[roomId].objects[playerRef] = <PhysicalObject>{
			debugLabel: "player ball",
			position: Vector3D.ZERO,
			orientation: Quaternion.IDENTITY,
			type: PhysicalObjectType.INDIVIDUAL,
			tilingBoundingBox: playerBb,
			physicalBoundingBox: playerBb,
			visualBoundingBox: playerBb,
			isAffectedByGravity: true,
			isRigid: true,
			stateFlags: 0,
			visualRef: playerVisualRef,
			velocity: new Vector3D(0,0,0),
			mass: 20,
			brain: <PlayerBrain>{
				desiredMoveDirection: 0,
				desiredMoveSpeed: 0
			}
		}
		const extraBallCount = 10;
		for( let i=0; i < extraBallCount; ++i ) {
			game.rooms[roomId].objects[newUuidRef()] = <PhysicalObject>{
				debugLabel: "extra ball "+i,
				position: new Vector3D((Math.random()-0.5)*10, (Math.random()-0.5)*10, 0),
				orientation: Quaternion.IDENTITY,
				type: PhysicalObjectType.INDIVIDUAL,
				tilingBoundingBox: playerBb,
				physicalBoundingBox: playerBb,
				visualBoundingBox: playerBb,
				isAffectedByGravity: true,
				isRigid: true,
				stateFlags: 0,
				visualRef: playerVisualRef,
				velocity: new Vector3D(0,0,0),
				mass: 20,
			}
		}
		
		let ts = Date.now();
		const animCallback = () => {
			const player = this.findPlayer();
			if( player == null ) return;
			
			const pp = player.position;
			
			this.worldView.clear();
			this.worldView.focusDistance = 16;
			this.worldView.drawScene(roomId, new Vector3D(-pp.x, -pp.y, this.worldView.focusDistance-pp.z), sim.time);
			
			const newTs = Date.now();
			if( newTs > ts ) {
				const interval = Math.min( (newTs - ts)/1000, 0.1 );
				sim.tick( interval );
			} // Otherwise something went weird and we just skip
			ts = newTs;
			
			window.requestAnimationFrame(animCallback);
		};
		window.requestAnimationFrame(animCallback);
		
		const kw = new KeyWatcher( (ev:KeyboardEvent,kw:KeyWatcher) => {
			//if( ev.type == 'keydown' ) console.log(ev.keyCode+" "+ev.type+"!");
			
			if( ev.type == 'keydown' && ev.keyCode == 80 ) {
				for( let r in sim.game.rooms ) {
					const room:Room = sim.game.rooms[r];
					for( let o in room.objects ) {
						const obj:PhysicalObject = room.objects[o];
						if( obj.velocity ) obj.velocity = Vector3D.ZERO;
					}
				}
			}

			const left  = kw.anyDown([37, 65]);
			const down  = kw.anyDown([40, 83]);
			const up    = kw.anyDown([38, 87]);
			const right = kw.anyDown([39, 68]);
			
			const tiltX = (left && !right) ? -1 : (right && !left) ? +1 : 0;
			const tiltY = (up && !down) ? -1 : (down && !up) ? +1 : 0;
			
			sim.gravityVector = new Vector3D(tiltX*9.8, tiltY*9.8, 0);
		});
		kw.register();
	}
}
