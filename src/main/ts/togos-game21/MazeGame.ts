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
import RoomGroupSimulator from './RoomGroupSimulator';

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

class WorldSimulator {
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
	
	protected findPlayerRoom():string {
		for( let r in this._game.rooms ) {
			const room = this._game.rooms[r];
			if( room.objects[this.playerRef] ) {
				return r;
			}
		}
		return null;
	}
	
	public runDemo() {
		const playerRef = this.playerRef = newUuidRef();
		
		const game = this.game = new DemoWorldGenerator().makeCrappyGame();
		const sim = new RoomGroupSimulator(game);
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
			isInteractive: true,
			isRigid: true,
			bounciness: 0.9,
			stateFlags: 0,
			visualRef: playerVisualRef,
			velocity: new Vector3D(0,0,0),
			mass: 20,
			brain: <PlayerBrain>{
				desiredMoveDirection: 0,
				desiredMoveSpeed: 0
			}
		}
		const extraBallCount = 100;
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
				isInteractive: true,
				isRigid: true,
				bounciness: 0.9,
				stateFlags: 0,
				visualRef: playerVisualRef,
				velocity: new Vector3D(0,0,0),
				mass: 20,
			}
		}
		
		let ts = Date.now();
		const animCallback = () => {
			const playerRoomRef = this.findPlayerRoom();
			const player = playerRoomRef == null ? null : this._game.rooms[playerRoomRef].objects[playerRef];
			if( player == null ) return;
			
			const pp = player.position;
			
			this.worldView.clear();
			this.worldView.focusDistance = 16;
			this.worldView.drawScene(playerRoomRef, new Vector3D(-pp.x, -pp.y, this.worldView.focusDistance-pp.z), sim.time);
			
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
