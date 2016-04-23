import ShapeSheet from './ShapeSheet';
import ShapeSheetTransforms from './ShapeSheetTransforms';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil from './ShapeSheetUtil';
import DirectionalLight from './DirectionalLight';
import KeyedList from './KeyedList';
import Material from './Material';
import SurfaceColor from './SurfaceColor';
import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import TransformationMatrix3D from './TransformationMatrix3D';
import Cuboid from './Cuboid';
import { ObjectVisual, MAObjectVisual, VisualBasisType} from './ObjectVisual';
import Animation, {OnAnimationEnd} from './Animation';
import ProceduralShape from './ProceduralShape';
import ImageSlice from './ImageSlice';
import ObjectImageManager from './ObjectImageManager';
import {DEFAULT_LIGHTS} from './Lights';
import {DEFAULT_MATERIALS, IDENTITY_MATERIAL_REMAP, makeRemap, remap} from './Materials';
import Rectangle from './Rectangle';
import { newType4Uuid, uuidUrn } from '../tshash/uuids';
import { Game, Room, PhysicalObject, PhysicalObjectType, TileTree } from './world';

const objectPosBuffer = new Vector3D;

let lastNumber = 0;
function newUuid() { return uuidUrn(newType4Uuid()); }

function simpleObjectVisualShape( drawFunction:(ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D )=>void ):MAObjectVisual {
	const shape:ProceduralShape = {
		isAnimated: false,
		estimateOuterBounds: (t:number, xf:TransformationMatrix3D) => {
			let s = xf.scale;
			return new Rectangle(-s*16, -s*16, s*16, s*16)
		},
		draw: drawFunction
	}
	
	// TODO: Also use drawn bounds to generate object bounding box, etc
	return {
		states: [
			{
				orientation: Quaternion.IDENTITY,
				applicabilityFlagsMax: 0xFFFFFFFF,
				applicabilityFlagsMin: 0x00000000,
				materialRemap: IDENTITY_MATERIAL_REMAP,
				animation: {
					length: Infinity,
					onEnd: OnAnimationEnd.LOOP,
					frames: [
						{
							visualBasisType: VisualBasisType.PROCEDURAL,
							materialRemap: IDENTITY_MATERIAL_REMAP,
							shape: shape
						}
					],
				}
			}
		]
	}
}

class DrawCommand {
	public image:HTMLImageElement;
	public special:(ctx:CanvasRenderingContext2D)=>void;
	public sx:number;
	public sy:number;
	public sw:number;
	public sh:number;
	public dx:number;
	public dy:number;
	public dw:number;
	public dh:number;
	public depth:number;
	
	public setImage(image:HTMLImageElement, sx:number, sy:number, sw:number, sh:number, dx:number, dy:number, dw:number, dh:number, depth:number) {
		this.image = image;
		this.special = null;
		this.sx = sx; this.sy = sy; this.sw = sw; this.sh = sh;
		this.dx = dx; this.dy = dy; this.dw = dw; this.dh = dh;
		this.depth = depth;
	}
	
	public setSpecial(f:(ctx:CanvasRenderingContext2D)=>void, depth:number) {
		this.image = null;
		this.special = f;
		this.depth = depth;
	}
}

function toArray<T,D extends ArrayLike<T>>(src:ArrayLike<T>, dest:D):D {
	for( let i=0; i<src.length; ++i ) dest[i] = src[i];
	return dest;
}
function toUint8Array(src:ArrayLike<number>):Uint8Array {
	return toArray(src, new Uint8Array(src.length));
}

export default class CanvasWorldView {
	protected canvas:HTMLCanvasElement;
	protected canvasContext:CanvasRenderingContext2D;
	protected objectImageManager:ObjectImageManager = new ObjectImageManager;
	protected game:Game;
	protected drawCommandBuffer:Array<DrawCommand> = [];
	protected drawCommandCount = 0;
	protected focusDistance = 10; // Distance at which we draw the foreground.  Fog is applied only behind this.
	protected fogColor = new SurfaceColor(0.2, 0.2, 0.2, 0.1); 
	
	public initUi(canvas:HTMLCanvasElement) {
		this.canvas = canvas;
		this.canvasContext = canvas.getContext('2d');
	};
	
	protected nextDrawCommand():DrawCommand {
		const dcb = this.drawCommandBuffer;
		let dc:DrawCommand;
		if( dcb.length == this.drawCommandCount ) {
			dcb.push(dc = new DrawCommand);
		} else {
			dc = dcb[this.drawCommandCount];
		}
		++this.drawCommandCount;
		return dc;
	}
	
	protected addImageDrawCommand(img:HTMLImageElement, sx:number, sy:number, sw:number, sh:number, dx:number, dy:number, dw:number, dh:number, depth:number):void {
		this.nextDrawCommand().setImage(img, sx, sy, sw, sh, dx, dy, dw, dh, depth);
	}
	
	protected addSpecialDrawCommand(f:(ctx:CanvasRenderingContext2D)=>void, depth:number):void {
		this.nextDrawCommand().setSpecial(f, depth);
	}
	
	protected flushDrawCommands():void {
		const dcb = this.drawCommandBuffer.slice(0, this.drawCommandCount);
		dcb.sort( (a:DrawCommand, b:DrawCommand) => b.depth - a.depth);
		const ctx = this.canvasContext;
		if( ctx != null ) for( let i in dcb ) {
			const dc = dcb[i];
			if( dc.image != null ) {
				ctx.drawImage(dc.image, dc.sx, dc.sy, dc.sw, dc.sh, dc.dx, dc.dy, dc.dw, dc.dh);
			} else if( dc.special != null ) {
				dc.special(ctx);
			} else {
				// Uhhh what's that idk
			}
		}
		this.drawCommandCount = 0;
	}
	
	protected screenCenterX:number;
	protected screenCenterY:number;
	
	protected drawIndividualObject( obj:PhysicalObject, pos:Vector3D, time:number ):void {
		let visual = this.game.objectVisuals[obj.visualRef];
		if( visual == null ) {
			console.log("Object visual "+obj.visualRef+" not loaded; can't draw");
			return;
		}
		
		const unitPpm = Math.min(this.canvas.width, this.canvas.height)/2; // Pixels per meter of a thing 1 meter away
		if( pos.z <= 1 ) return;
		const scale = unitPpm / pos.z;
		const screenX = this.screenCenterX + scale * pos.x;
		const screenY = this.screenCenterY + scale * pos.y;
		const reso = 16; // TODO: Should depend on scale, but not just be scale; maybe largest **2 <= scale and <= 32?
		
		const imgSlice = this.objectImageManager.objectVisualImage(visual, obj.stateFlags, time, obj.orientation, reso);
		const pixScale = scale/imgSlice.resolution;
		this.addImageDrawCommand(
			imgSlice.sheet,
			imgSlice.bounds.minX, imgSlice.bounds.minY, imgSlice.bounds.width, imgSlice.bounds.height,
			screenX - imgSlice.origin.x*pixScale, screenY - imgSlice.origin.y*pixScale, imgSlice.bounds.width*pixScale, imgSlice.bounds.height*pixScale,
			pos.z // TODO: subtract visual's stickey-outeyness
		);
	}
	
	protected drawObject( obj:PhysicalObject, pos:Vector3D, time:number ):void {
		switch( obj.type ) {
		case PhysicalObjectType.INDIVIDUAL:
			this.drawIndividualObject(obj, obj.position ? Vector3D.add(pos, obj.position, objectPosBuffer) : pos, time);
			break;
		case PhysicalObjectType.TILE_TREE:
			const tt = <TileTree>obj;
			const tilePaletteIndexes = tt.childObjectIndexes;
			const tilePalette = this.game.tilePalettes[tt.childObjectPaletteRef];
			const objectPrototypes = this.game.objectPrototypes;
			const childPosBuf = new Vector3D;
			const xd = tt.divisionBox.width/tt.xDivisions;
			const yd = tt.divisionBox.height/tt.yDivisions;
			const zd = tt.divisionBox.depth/tt.zDivisions;
			const x0 = pos.x - tt.divisionBox.width/2  + xd/2;
			const y0 = pos.y - tt.divisionBox.height/2 + yd/2;
			const z0 = pos.z - tt.divisionBox.depth/2  + zd/2;
			for( let i=0, z=0; z < tt.zDivisions; ++z ) for( let y=0; y < tt.yDivisions; ++y ) for( let x=0; x < tt.xDivisions; ++x, ++i ) {
				const childId = tilePalette[tilePaletteIndexes[i]];
				if( childId != null ) {
					const child = objectPrototypes[childId];
					this.drawObject( child, childPosBuf.set(x0+x*xd, y0+y*yd, z0+z*zd), time );
				}
			}
			break;
		default:
			console.log("Unrecognized objec type! "+obj.type)
			break;
		}
	}
	
	protected drawRoom( room:Room, pos:Vector3D, time:number ):void {
		for( let o in room.objects ) {
			const obj = room.objects[o];
			this.drawObject(obj, Vector3D.add(pos, obj.position, objectPosBuffer), time);
		}
	}
	
	protected drawScene( roomId:string, pos:Vector3D, time:number ):void {
		this.screenCenterX = this.canvas.width/2;
		this.screenCenterY = this.canvas.height/2;
		
		const room = this.game.rooms[roomId];
		if( room == null ) {
			console.log("Failed to load room "+roomId+"; can't draw it.")
			return;
		};
		this.drawRoom(room, pos, time);
		const neighborPos = new Vector3D;
		for( let n in room.neighbors ) {
			let neighbor = room.neighbors[n];
			let neighborRoom = this.game.rooms[neighbor.roomId];
			if( neighborRoom == null ) {
				console.log("Failed to load neighbor room "+neighbor.roomId+"; can't draw it.");
				continue;
			}
			this.drawRoom(neighborRoom, Vector3D.add(pos, neighbor.offset, neighborPos), time);
		}
		
		const fogColorStr = this.fogColor.toRgbaString();
		for( let i=0; i<100; ++i ) {
			this.addSpecialDrawCommand(
				(ctx:CanvasRenderingContext2D) => {
					ctx.fillStyle = fogColorStr; // Fawg
					ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
				},
				this.focusDistance + i+0.5
			);
		}
		
		this.flushDrawCommands();
	}
	
	protected makeCrappyGame():Game {
		const crappyBlockVisualId = newUuid();
		const crappyBrickVisualId = newUuid();
		const crappyRoomId = newUuid();
		const theMaterialMap = DEFAULT_MATERIALS;
		const roomObjects:KeyedList<PhysicalObject> = {};
		for( let i=0; i<100; ++i ) {
			const objectId = newUuid();
			roomObjects[objectId] = {
				position: new Vector3D((Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10),
				orientation: Quaternion.IDENTITY,
				type: PhysicalObjectType.INDIVIDUAL,
				isRigid: true,
				isAffectedByGravity: false,
				stateFlags: 0,
				visualRef: crappyBlockVisualId,
				physicalBoundingBox: new Cuboid(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5),
				visualBoundingBox: new Cuboid(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5)
			};
		}
		
		const blockMaVisual:MAObjectVisual = simpleObjectVisualShape( (ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D) => {
			const center = xf.multiplyVector(Vector3D.ZERO);
			const size = xf.scale;
			ssu.plottedDepthFunction = (x:number, y:number, z:number) => z;
			ssu.plottedMaterialIndexFunction = (x:number, y:number, z:number) => 8;
			ssu.plotAASharpBeveledCuboid( center.x-size/2, center.y-size/2, center.z-size/2, size, size, size/6);
		});
		const blockMaterialMap = DEFAULT_MATERIALS; 
		const blockVisual:ObjectVisual = {
			materialMap: DEFAULT_MATERIALS,
			maVisual: blockMaVisual
		}
		const brickRemap = makeRemap(8,4,4);
		const brickVisual:ObjectVisual = {
			materialMap: remap(DEFAULT_MATERIALS, brickRemap),
			maVisual: blockMaVisual
		}
		
		const brickPrototypeId = newUuid();
		const brick:PhysicalObject = {
			position: null,
			orientation: Quaternion.IDENTITY,
			type: PhysicalObjectType.INDIVIDUAL,
			isRigid: true,
			isAffectedByGravity: false,
			stateFlags: 0,
			visualRef: crappyBrickVisualId,
			physicalBoundingBox: new Cuboid(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5),
			visualBoundingBox: new Cuboid(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5)
		}
		
		const tilePaletteRef = newUuid();
		const tilePalette = [
			null,
			brickPrototypeId
		];
		
		const tileTree:TileTree = {
			position: new Vector3D(0,0,0),
			orientation: Quaternion.IDENTITY,
			visualBoundingBox: new Cuboid(-2,-2,-0.5,+2,+2,+0.5),
			physicalBoundingBox: new Cuboid(-2,-2,-0.5,+2,+2,+0.5),
			type: PhysicalObjectType.TILE_TREE,
			divisionBox: new Cuboid(-2,-2,-0.5,+2,+2,+0.5),
			xDivisions: 4,
			yDivisions: 4,
			zDivisions: 1,
			childObjectPaletteRef: tilePaletteRef,
			childObjectIndexes: toUint8Array([
				1,1,1,1,
				1,0,0,1,
				1,0,0,1,
				1,1,1,1,
			]),
			// These don't really make sense to have to have on a tile tree
			isAffectedByGravity: false,
			isRigid: false,
			stateFlags: 0,
			visualRef: null
		}
		
		const tileTreeUuid = newUuid();
		roomObjects[tileTreeUuid] = tileTree;
		
		return {
			objectVisuals: {
				[crappyBlockVisualId]: blockVisual,
				[crappyBrickVisualId]: brickVisual,
			},
			rooms: {
				[crappyRoomId]: {
					objects: roomObjects,
					neighbors: {}
				}
			},
			tilePalettes: {
				[tilePaletteRef]: tilePalette
			},
			objectPrototypes: {
				[brickPrototypeId]: brick
			}
		};
	}
	
	public runDemo() {
		this.game = this.makeCrappyGame();
		let roomId:string;
		for( roomId in this.game.rooms ); // Just find one; whatever.
		
		const animCallback = () => {
			let t = Date.now()/1000;
			this.canvasContext.clearRect(0,0,this.canvas.width,this.canvas.height);
			this.focusDistance = 16;
			this.drawScene(roomId, new Vector3D(Math.cos(t)*4, Math.sin(t*0.3)*4, this.focusDistance), 0);
			window.requestAnimationFrame(animCallback);
		};
		window.requestAnimationFrame(animCallback);
	}
}
