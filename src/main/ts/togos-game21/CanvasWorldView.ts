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
import {DEFAULT_LIGHTS} from './lights';
import {DEFAULT_MATERIALS, IDENTITY_MATERIAL_REMAP, makeRemap, remap} from './materials';
import Rectangle from './Rectangle';
import { newType4Uuid, uuidUrn } from '../tshash/uuids';
import { Game, Room, PhysicalObject, PhysicalObjectType, TileTree } from './world';
import DemoWorldGenerator from './DemoWorldGenerator';

const posBuffer0 = new Vector3D;
const neighborPos = new Vector3D;
const objectPosBuffer = new Vector3D;

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
	protected drawCommandBuffer:Array<DrawCommand> = [];
	protected drawCommandCount = 0;
	
	public game:Game;
	public focusDistance = 10; // Distance at which we draw the foreground.  Fog is applied only behind this.
	public fogColor = new SurfaceColor(0.2, 0.2, 0.2, 0.1); 
	
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
		
		// unitPpm = pixels per meter of a thing 1 meter away;
		// in the future this should be calculated differently, taking some FoV into account:
		const unitPpm = Math.min(this.canvas.width, this.canvas.height)/2;
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
	
	/** Object's .position should already be taken into account in 'pos' */
	protected drawObject( obj:PhysicalObject, pos:Vector3D, time:number ):void {
		switch( obj.type ) {
		case PhysicalObjectType.INDIVIDUAL:
			this.drawIndividualObject(obj, pos, time);
			break;
		case PhysicalObjectType.TILE_TREE:
			const tt = <TileTree>obj;
			const tilePaletteIndexes = tt.childObjectIndexes;
			const tilePalette = this.game.tilePalettes[tt.childObjectPaletteRef];
			const objectPrototypes = this.game.objectPrototypes;
			const childPosBuf = new Vector3D;
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
			this.drawObject(obj, Vector3D.add(pos, obj.position, posBuffer0), time);
		}
	}
	
	public drawScene( roomId:string, pos:Vector3D, time:number ):void {
		this.screenCenterX = this.canvas.width/2;
		this.screenCenterY = this.canvas.height/2;
		
		const room = this.game.rooms[roomId];
		if( room == null ) {
			console.log("Failed to load room "+roomId+"; can't draw it.")
			return;
		};
		this.drawRoom(room, pos, time);
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
	
	public clear() {
		this.canvasContext.clearRect(0,0,this.canvas.width,this.canvas.height);
	}
}
