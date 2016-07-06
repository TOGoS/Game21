import ShapeSheetUtil from './ShapeSheetUtil';
import TransformationMatrix3D from './TransformationMatrix3D';
import ObjectVisual, { VisualBasisType } from './ObjectVisual';
import ProceduralShape from './ProceduralShape';
import Rectangle from './Rectangle';
import Cuboid from './Cuboid';
import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import KeyedList from './KeyedList';
import { DEFAULT_MATERIAL_PALETTE, DEFAULT_MATERIAL_PALETTE_REF, DEFAULT_MATERIAL_MAP, IDENTITY_MATERIAL_REMAP } from './surfacematerials';
import CanvasWorldView from './CanvasWorldView';
import DemoWorldGenerator, { newUuidRef, simpleObjectVisualShape } from './DemoWorldGenerator';
import { PhysicalObjectType, PhysicalObject, TileTree, Room, Game, HUNIT_CUBE } from './world';
import { deepFreeze, isDeepFrozen, thaw } from './DeepFreezer';
import RoomGroupSimulator from './RoomGroupSimulator';
import SurfaceColor from './SurfaceColor';

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
	public simulator:RoomGroupSimulator;
	public mouseCoordsBox:HTMLElement;
	public fpsBox:HTMLElement;
	public initUi(canvas:HTMLCanvasElement) {
		this.worldView = new CanvasWorldView();
		this.worldView.initUi(canvas);
		this.worldView.game = this._game;
	}
	
	get game():Game { return this._game; }
	set game(g:Game) {
		this._game = g;
		if( this.worldView ) this.worldView.game = g;
		this.simulator = new RoomGroupSimulator(g);
	}
	
	public playerRef:string;
	
	public set gravityVector(v:Vector3D) {
		if( this.simulator ) this.simulator.gravityVector = v;
	}
	
	public runDemo() {
		const playerRef = this.playerRef = newUuidRef();
		
		const game = new DemoWorldGenerator().makeCrappyGame();
		let roomId:string;
		for( roomId in game.rooms ); // Just find one; whatever.
		// Put player in it!
		
		const ballMaVisualRef = 'urn:uuid:f68c8cb4-1c01-4683-b726-6bf9cd9efc5c';
		game.maObjectVisuals[ballMaVisualRef] = simpleObjectVisualShape( (ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D ) => {
			ssu.plottedMaterialIndexFunction = () => 4;
			const origin:Vector3D = xf.multiplyVector(Vector3D.ZERO);
			ssu.plotSphere(origin.x, origin.y, origin.z, xf.scale/2);
		});
		
		const playerMaterialRef = 'urn:uuid:9ce214f5-7c29-4eff-a749-f74dc9b13201';
		game.materials[playerMaterialRef] = {
			title: "player ball material",
			diffuse: new SurfaceColor(1,0.5,0.5,1),
		};
		
		const noGravMaterialRef = 'urn:uuid:91014423-9e91-4285-98f9-cbb0275d1b6f';
		game.materials[noGravMaterialRef] = {
			title: "no-gravity ball material",
			diffuse: new SurfaceColor(0.5,0.6,0.8,1),
		};
		
		const playerMaterialPaletteRef = 'urn:uuid:b66d6d3c-571f-4579-8d0d-0a9f3d395990';
		game.materialPalettes[playerMaterialPaletteRef] = [null,null,null,null,playerMaterialRef];
		
		const noGravMaterialPaletteRef = 'urn:uuid:1d34436b-cfd5-4a38-b299-19f58439ed1a';
		game.materialPalettes[noGravMaterialPaletteRef] = [null,null,null,null,noGravMaterialRef];
		
		const ballVisualRef = 'urn:uuid:63c6e0a7-58a3-4b73-aa63-5f5a48aab96e';
		game.objectVisuals[ballVisualRef] = {
			materialPaletteRef: DEFAULT_MATERIAL_PALETTE_REF,
			maVisualRef: ballMaVisualRef
		};
		const noGravBallVisualRef = 'urn:uuid:b8a1e9be-d6c0-451c-a83f-44392754db14';
		game.objectVisuals[noGravBallVisualRef] = {
			materialPaletteRef: noGravMaterialPaletteRef,
			maVisualRef: ballMaVisualRef
		};
		
		const playerVisualRef = 'urn:uuid:aff97a48-eb22-4108-adeb-94a96850c834';
		game.objectVisuals[playerVisualRef] = {
			materialPaletteRef: playerMaterialPaletteRef,
			maVisualRef: ballMaVisualRef
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
		const extraBallCount = 5;
		for( let i=0; i < extraBallCount; ++i ) {
			const grav = Math.random() < 0.5;
			game.rooms[roomId].objects[newUuidRef()] = <PhysicalObject>{
				debugLabel: "extra ball "+i,
				position: new Vector3D((Math.random()-0.5)*10, (Math.random()-0.5)*10, 0),
				orientation: Quaternion.IDENTITY,
				type: PhysicalObjectType.INDIVIDUAL,
				tilingBoundingBox: playerBb,
				physicalBoundingBox: playerBb,
				visualBoundingBox: playerBb,
				isAffectedByGravity: grav,
				isInteractive: true,
				isRigid: true,
				bounciness: 0.9,
				stateFlags: 0,
				visualRef: grav ? ballVisualRef : noGravBallVisualRef,
				velocity: new Vector3D(0,0,0),
				mass: 20,
			}
		}
		
		this.game = game;
		const sim = this.simulator;
		
		let ts = Date.now();
		this.worldView.focusDistance = 16;
		const animCallback = () => {
			const player = sim.getObject(playerRef);
			const playerRoomRef = sim.objectRoomRef(player);
			playerRoomRef == null ? null : this._game.rooms[playerRoomRef].objects[playerRef];
			if( player == null ) return;
			
			const pp = player.position;
			
			this.worldView.clear();
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
			if( ev.type == 'keydown' ) {
				switch( ev.keyCode ) {
				case 80:
					for( let r in sim.game.rooms ) {
						const room:Room = sim.game.rooms[r];
						for( let o in room.objects ) {
							const obj:PhysicalObject = room.objects[o];
							if( obj.velocity ) obj.velocity = Vector3D.ZERO;
						}
					}
					break;
				case 107: case 187: // '+'
					this.worldView.focusDistance /= 2;
					break;
				case 109: case 189: // '-'
					this.worldView.focusDistance *= 2;
					break;
				case 37: case 65: case 40: case 83: case 38: case 87: case 39: case 68:
					break;
				case 86:
					this.worldView.visibilityMaskingMode = (this.worldView.visibilityMaskingMode + 1) % 3;
					break;
				default:
					console.log(ev.keyCode+" "+ev.type+"!");
					break;
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
		
		let mouseIsDown = false;
		let mouseX:number = 0, mouseY:number = 0; // Relative to the canvas element
		
		const mouseUpdated = () => {
			if( mouseIsDown ) {
				const canv = this.worldView.canvas;
				const px = mouseX * (canv.width  / canv.clientWidth ),
					py = mouseY * (canv.height / canv.clientHeight);
				// TODO
				const wp:Vector3D = this.worldView.canvasToWorldCoordinates(px, py);
				//console.log(wp.x, wp.y);
				let textNode:Node;
				if( this.mouseCoordsBox && (textNode = this.mouseCoordsBox.firstChild) ) {
					textNode.nodeValue = wp.x.toPrecision(2)+", "+wp.y.toPrecision(2);
					//textNode.nodeValue = canvX.toPrecision(4)+", "+canvY.toPrecision(4);
				}
				
				const grav:boolean = Math.random() < 0.5;
				const player = sim.getObject(playerRef);
				const roomId = sim.objectRoomRef(player);
				sim.addObject(roomId,  <PhysicalObject>{
					debugLabel: "user-created extra ball",
					position: Vector3D.add(player.position, wp),
					orientation: Quaternion.IDENTITY,
					type: PhysicalObjectType.INDIVIDUAL,
					tilingBoundingBox: playerBb,
					physicalBoundingBox: playerBb,
					visualBoundingBox: playerBb,
					isAffectedByGravity: grav,
					isInteractive: true,
					isRigid: true,
					bounciness: 0.9,
					stateFlags: 0,
					visualRef: grav ? ballVisualRef : noGravBallVisualRef,
					velocity: player.velocity,
					mass: 20,
				});
			}
		};
		
		this.worldView.canvas.addEventListener('mousemove', (ev:MouseEvent) => {
			mouseX = ev.offsetX;
			mouseY = ev.offsetY;
			mouseUpdated();
		});
		
		this.worldView.canvas.addEventListener('mousedown', (ev:MouseEvent) => {
			mouseIsDown = true;
			mouseX = ev.offsetX;
			mouseY = ev.offsetY;
			mouseUpdated();
		});
		this.worldView.canvas.addEventListener('mouseup', (ev:MouseEvent) => {
			mouseIsDown = false;
			mouseX = ev.offsetX;
			mouseY = ev.offsetY;
			mouseUpdated();
		});
	}
}
