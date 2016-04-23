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
import ObjectVisual, {VisualBasisType} from './ObjectVisual';
import Animation, {OnAnimationEnd} from './Animation';
import ProceduralShape from './ProceduralShape';
import ImageSlice from './ImageSlice';
import ObjectImageManager from './ObjectImageManager';
import {DEFAULT_LIGHTS} from './Lights';
import {DEFAULT_MATERIALS, IDENTITY_MATERIAL_REMAP} from './Materials';
import Rectangle from './Rectangle';
import { newType4Uuid, uuidUrn } from '../tshash/uuids';

interface RoomNeighbor {
	offset:Vector3D;
	/**
	 * The room's bounding box, relative to its offset.
	 * This is duplicated from the room's own data.
	 */
	bounds:Cuboid;
	roomId:string;
}

enum ObjectType {
	TILE_TREE,
	INDIVIDUAL
}

interface PhysicalObject {
	position:Vector3D; // Ignored (and should be null) for tiles/prototypes
	
	type:ObjectType;
	orientation:Quaternion;
	visualRef:string;
	// Bounding boxes are relative to the object's position (whether indicated externally or internally)
	physicalBoundingBox:Cuboid;
	visualBoundingBox:Cuboid;
	isAffectedByGravity:boolean;
	isRigid:boolean;
	stateFlags:number;
}

interface TileTree extends PhysicalObject {
	divisionBox:Cuboid; // The box that's divided; may be larger or smaller than the physical bounding box
	xDivisions:number;
	yDivisions:number;
	zDivisions:number;
	childObjectPaletteRef:string;
	childObjectIndexes:Uint8Array;
}

interface Room {
	objects:KeyedList<PhysicalObject>;
	neighbors:KeyedList<RoomNeighbor>;
}

interface Game {
	objectVisuals: KeyedList<ObjectVisual>;
	objectPrototypes: KeyedList<PhysicalObject>;
	rooms: KeyedList<Room>;
}

const objectPosBuffer = new Vector3D;

let lastNumber = 0;
function newUuid() { return uuidUrn(newType4Uuid()); }

function simpleObjectVisual( drawFunction:(ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D )=>void ):ObjectVisual {
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
		materialMap: DEFAULT_MATERIALS,
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
	
	protected drawObject( obj:PhysicalObject, pos:Vector3D, time:number ):void {
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
	
	protected drawRoom( room:Room, pos:Vector3D, time:number ):void {
		for( let o in room.objects ) {
			const obj = room.objects[o];
			if( obj.type == ObjectType.INDIVIDUAL ) {
				this.drawObject(obj, Vector3D.add(pos, obj.position, objectPosBuffer), time);
			}
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
		const crappyRoomId = newUuid();
		const theMaterialMap = DEFAULT_MATERIALS;
		const roomObjects:KeyedList<PhysicalObject> = {};
		for( let i=0; i<100; ++i ) {
			const objectId = newUuid();
			roomObjects[objectId] = {
				position: new Vector3D((Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10),
				orientation: Quaternion.IDENTITY,
				type: ObjectType.INDIVIDUAL,
				isRigid: true,
				isAffectedByGravity: false,
				stateFlags: 0,
				visualRef: crappyBlockVisualId,
				physicalBoundingBox: new Cuboid(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5),
				visualBoundingBox: new Cuboid(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5)
			};
		}
		
		return {
			objectVisuals: {
				[crappyBlockVisualId]: simpleObjectVisual( (ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D) => {
					const center = xf.multiplyVector(Vector3D.ZERO);
					const size = xf.scale;
					ssu.plottedDepthFunction = (x:number, y:number, z:number) => z;
					ssu.plottedMaterialIndexFunction = (x:number, y:number, z:number) => 8;
					ssu.plotAASharpBeveledCuboid( center.x-size/2, center.y-size/2, center.z-size/2, size, size, size/6);
				})
			},
			rooms: {
				[crappyRoomId]: {
					objects: roomObjects,
					neighbors: {}
				}
			},
			objectPrototypes: {
				
			}
		};
	}
	
	public runDemo() {
		this.game = this.makeCrappyGame();
		let roomId;
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
