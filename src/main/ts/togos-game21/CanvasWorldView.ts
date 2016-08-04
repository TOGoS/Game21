import ShapeSheet from './ShapeSheet';
import ShapeSheetTransforms from './ShapeSheetTransforms';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil from './ShapeSheetUtil';
import DirectionalLight from './DirectionalLight';
import KeyedList from './KeyedList';
import SurfaceMaterial from './SurfaceMaterial';
import SurfaceColor from './SurfaceColor';
import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import TransformationMatrix3D from './TransformationMatrix3D';
import Cuboid from './Cuboid';
import { ObjectVisual, MAObjectVisual, VisualBasisType} from './ObjectVisual';
import ProceduralShape from './ProceduralShape';
import ImageSlice from './ImageSlice';
import ObjectImageManager from './ObjectImageManager';
import {DEFAULT_LIGHTS} from './lights';
import {DEFAULT_MATERIAL_MAP, IDENTITY_MATERIAL_REMAP, makeRemap, remap} from './surfacematerials';
import Rectangle from './Rectangle';
import { newType4Uuid, uuidUrn } from '../tshash/uuids';
import { Game, Room, PhysicalObject, ProtoObject, PhysicalObjectType, TileTree } from './world';
import { eachSubObject } from './worldutil';
import DemoWorldGenerator from './DemoWorldGenerator';
import SceneShader, { ShadeRaster } from './SceneShader';

// Buffer used for room object positions
const posBuffer0 = new Vector3D;
const neighborPos = new Vector3D;
// Buffer used for tile tree sub-object positions
//const ttPosBuffer = new Vector3D;

const sceneShader:SceneShader = new SceneShader();

enum VisibilityMaskingMode {
	NONE, // Draw everything!
	SOLID, // Draw black squares over non-visible areas
	FADE
}

class DrawCommand {
	public image?:HTMLImageElement;
	public special?:(ctx:CanvasRenderingContext2D)=>void;
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
		this.special = undefined;
		this.sx = sx; this.sy = sy; this.sw = sw; this.sh = sh;
		this.dx = dx; this.dy = dy; this.dw = dw; this.dh = dh;
		this.depth = depth;
	}
	
	public setSpecial(f:(ctx:CanvasRenderingContext2D)=>void, depth:number) {
		this.image = undefined;
		this.special = f;
		this.depth = depth;
	}
}

export default class CanvasWorldView {
	protected _canvas : HTMLCanvasElement|null = null;
	protected canvasContext : CanvasRenderingContext2D|null = null;
	protected objectImageManager : ObjectImageManager|null = null;
	protected drawCommandBuffer : Array<DrawCommand> = [];
	protected drawCommandCount = 0;
	
	protected _game:Game;
	public focusDistance = 10; // Distance at which we draw the foreground.  Fog is applied only behind this.
	public fogColor = new SurfaceColor(0.2, 0.2, 0.2, 0.1); // Should probably come from game data somehow
	public visibilityMaskingMode:VisibilityMaskingMode = VisibilityMaskingMode.SOLID;
	
	public initUi(canvas:HTMLCanvasElement) {
		this._canvas = canvas;
		this.canvasContext = canvas.getContext('2d');
	};
	
	public get game():Game { return this._game; }
	public set game(g:Game) {
		this._game = g;
		this.objectImageManager = new ObjectImageManager(g);
	}
	
	public get canvas():HTMLCanvasElement|null { return this._canvas; }
	
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
				dc.special.call(this, ctx);
			} else {
				// Uhhh what's that idk
			}
		}
		this.drawCommandCount = 0;
	}
	
	protected screenCenterX:number;
	protected screenCenterY:number;
	protected clip:Rectangle = new Rectangle;
	
	protected drawTime:number; // Timestamp for current drawing
	
	protected get unitPpm():number {
		if( !this._canvas ) return 16;
		// TODO: configure somehow based on FoV
		return Math.max(this._canvas.width, this._canvas.height)/2;
	}
	
	protected drawIndividualObject( proto:ProtoObject, stateFlags:number, pos:Vector3D, orientation:Quaternion ):void {
		if( !proto || !proto.visualRef ) {
			return;
		}
		let visual = this.game.objectVisuals[proto.visualRef];
		if( visual == null ) {
			console.log("Object visual "+proto.visualRef+" not loaded; can't draw");
			return;
		}
		if( !this.objectImageManager ) {
			console.log("No object image manager; can't render object visuals");
			return;
		}
		
		// unitPpm = pixels per meter of a thing 1 meter away;
		// in the future this should be calculated differently, taking some FoV into account:
		const unitPpm = this.unitPpm;
		if( pos.z <= 1 ) return;
		const scale = unitPpm / pos.z;
		const screenX = this.screenCenterX + scale * pos.x;
		const screenY = this.screenCenterY + scale * pos.y;
		const reso = 16; // TODO: Should depend on scale, but not just be scale; maybe largest **2 <= scale and <= 32?
		
		const imgSlice = this.objectImageManager.objectVisualImage(visual, stateFlags, this.drawTime, orientation, reso);
		if( !imgSlice ) return;
		const pixScale = scale/imgSlice.resolution;
		this.addImageDrawCommand(
			imgSlice.sheet,
			imgSlice.bounds.minX, imgSlice.bounds.minY, imgSlice.bounds.width, imgSlice.bounds.height,
			screenX - imgSlice.origin.x*pixScale, screenY - imgSlice.origin.y*pixScale, imgSlice.bounds.width*pixScale, imgSlice.bounds.height*pixScale,
			pos.z // TODO: subtract visual's stickey-outeyness
		);
	}
	
	/** Object's .position should already be taken into account in 'pos' */
	protected drawObject( proto:ProtoObject, stateFlags:number, pos:Vector3D, orientation:Quaternion ):void {
		const vbb = proto.visualBoundingBox;
		const backZ = vbb.maxZ + pos.z;
		if( backZ <= 1 ) return;
		const backScale = this.unitPpm / backZ;
		if( this.screenCenterX + backScale * (vbb.maxX + pos.x) <= this.clip.minX ) return;
		if( this.screenCenterX + backScale * (vbb.minX + pos.x) >= this.clip.maxX ) return;
		if( this.screenCenterY + backScale * (vbb.maxY + pos.y) <= this.clip.minY ) return;
		if( this.screenCenterY + backScale * (vbb.minY + pos.y) >= this.clip.maxY ) return;
		
		if( proto.visualRef != null ) {
			this.drawIndividualObject(proto, stateFlags, pos, orientation);
		}
		
		eachSubObject( proto, pos, this._game, this.drawObject, this, posBuffer0 );
	}
	
	protected drawRoom( room:Room, pos:Vector3D ):void {
		for( let o in room.objects ) {
			const obj = room.objects[o];
			if( !obj.position ) {
				throw new Error("Object '"+o+"' in room has no position");
			}
			const proto = this.game.protoObjects[obj.prototypeRef];
			if( proto == null ) continue;
			const orientation = obj.orientation ? obj.orientation : Quaternion.IDENTITY;
			this.drawObject(proto, obj.stateFlags, Vector3D.add(pos, obj.position, posBuffer0), orientation);
		}
	}
	
	protected opacityRaster:ShadeRaster;
	protected visibilityRaster:ShadeRaster;
	protected shadeRaster:ShadeRaster;
	
	protected initShadeRasters(w:number, h:number) {
		if( this.opacityRaster == null || this.opacityRaster.width != w || this.opacityRaster.height != h ) {
			this.opacityRaster = new ShadeRaster(w, h, 1, w/2, h/2);
			this.visibilityRaster = new ShadeRaster(w, h, 1, w/2, h/2);
			this.shadeRaster = new ShadeRaster(w, h, 1, w/2, h/2);
		}
	}
	
	protected shadeImages:HTMLImageElement[] = [];
	protected getShadeImage(shadeData:number) : HTMLImageElement {
		if( this.shadeImages[shadeData] == null ) {
			const canv = <HTMLCanvasElement>document.createElement('canvas');
			canv.width = 8;
			canv.height = 8;
			const ctx = canv.getContext('2d');
			if( !ctx ) throw new Error("No 2d context on canvas; can't generate shade image");
			const id:ImageData = ctx.createImageData(8, 8);
			const idd=id.data;
			const opacityTL = 1 - ((shadeData >> 6) & 0x3) / 3;
			const opacityTR = 1 - ((shadeData >> 4) & 0x3) / 3;
			const opacityBL = 1 - ((shadeData >> 2) & 0x3) / 3;
			const opacityBR = 1 - ( shadeData       & 0x3) / 3;
			
			for( let y=0, i=0; y<8; ++y ) {
				const opacityL = opacityTL + y*(opacityBL-opacityTL)/8;
				const opacityR = opacityTR + y*(opacityBR-opacityTR)/8;
				for( let x=0; x<8; ++x, ++i ) {
					const opacity = opacityL + x*(opacityR-opacityL)/8;
					idd[(i<<2)+3] = Math.round(opacity * 255);
				}
			}
			
			ctx.putImageData(id, 0, 0);
			const img = <HTMLImageElement>document.createElement('img');
			img.src = canv.toDataURL();
			this.shadeImages[shadeData] = img;
		}
		return this.shadeImages[shadeData];
	}
	
	public drawScene( roomId:string, pos:Vector3D, time:number ):void {
		if( !this._canvas ) {
			console.log("No canas; can't draw scene");
			return;
		}
		
		const canv = this._canvas;
		
		this.drawTime = time;
		
		// Make pos a little more manageable
		// so that math doesn't screw up due to rounding errors
		pos = pos.roundToGrid(1/64, 1/64, 1/64);
		
		this.screenCenterX = canv.width/2;
		this.screenCenterY = canv.height/2;
		
		const focusScale = this.unitPpm/this.focusDistance;
		
		this.initShadeRasters(40,40);
		const opacityRaster    = this.opacityRaster;
		const visibilityRaster = this.visibilityRaster;
		const shadeRaster      = this.shadeRaster;
		
		const shadePos = Vector3D.ZERO;
		
		if( this.visibilityMaskingMode == VisibilityMaskingMode.NONE ) {
			this.clip.set(0, 0, canv.width, canv.height);
		} else {
			// Set shade origin such that the shade corner matches up to an integer coordinate in the world
			opacityRaster.originX = (opacityRaster.width /opacityRaster.resolution/2) + (Math.round(pos.x) - pos.x);
			opacityRaster.originY = (opacityRaster.height/opacityRaster.resolution/2) + (Math.round(pos.y) - pos.y);
			sceneShader.sceneOpacityRaster(roomId, pos, this._game, opacityRaster);
			visibilityRaster.data.fill(0);
			sceneShader.opacityTolVisibilityRaster(
				opacityRaster,
				Math.floor(opacityRaster.originX*opacityRaster.resolution),
				Math.floor(opacityRaster.originY*opacityRaster.resolution),
				255, visibilityRaster
			);
			sceneShader.visibilityToShadeRaster( visibilityRaster, shadeRaster );
		
			opacityRaster.getBounds(this.clip);
			this.clip.set(
				Math.round(this.screenCenterX + this.clip.minX*focusScale),
				Math.round(this.screenCenterY + this.clip.minY*focusScale),
				Math.round(this.screenCenterX + this.clip.maxX*focusScale),
				Math.round(this.screenCenterY + this.clip.maxY*focusScale)
			);
		}
		
		const room = this.game.rooms[roomId];
		if( room == null ) {
			console.log("Failed to load room "+roomId+"; can't draw it.")
			return;
		};
		this.drawRoom(room, pos);
		for( let n in room.neighbors ) {
			let neighbor = room.neighbors[n];
			let neighborRoom = this.game.rooms[neighbor.roomRef];
			if( neighborRoom == null ) {
				console.log("Failed to load neighbor room "+neighbor.roomRef+"; can't draw it.");
				continue;
			}
			this.drawRoom(neighborRoom, Vector3D.add(pos, neighbor.offset, neighborPos));
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
		
		if( this.visibilityMaskingMode != VisibilityMaskingMode.NONE ) this.addSpecialDrawCommand( (ctx:CanvasRenderingContext2D) => {
			const cellSize = focusScale/opacityRaster.resolution;
			if( Math.round(cellSize) != cellSize ) console.log("Warning!  Cell size (in pixels) at focus distance is not an integer: "+cellSize);
			let dy = Math.round(this.screenCenterY + focusScale*(shadePos.y - opacityRaster.originY)); 
			for( let y=0, i=0; y < opacityRaster.height; ++y, dy += cellSize ) {
				if( dy+cellSize <= this.clip.minY || dy > this.clip.maxY ) { i += opacityRaster.width; continue; }
				
				let dx = Math.round(this.screenCenterX + focusScale*(shadePos.x - opacityRaster.originX));
				for( let x=0; x < opacityRaster.width; ++x, ++i, dx += cellSize ) {
					if( dx+cellSize <= this.clip.minX || dx > this.clip.maxX ) continue;
					
					if( shadeRaster.data[i] == 255 ) {
						// It's totally transparent!
					} else if( shadeRaster.data[i] == 0 ) {
						// It's black!
						ctx.fillStyle = 'rgba(0,0,0,1)';
						ctx.fillRect( dx, dy, cellSize, cellSize );
					} else {
						// Want things to go SLOWER?
						// (And have gradients on the walls?)
						if( this.visibilityMaskingMode == VisibilityMaskingMode.FADE ) {
							ctx.drawImage( this.getShadeImage(shadeRaster.data[i]), dx, dy, cellSize, cellSize );
						}
					}
					/*
					// TODO: Combine longer spans of black into single draw calls
					if( visibilityRaster.data[i] < 255 ) {
						ctx.fillStyle = 'rgba(0,0,0,'+((255-visibilityRaster.data[i])/255)+')';
						ctx.fillRect( dx, dy, cellSize, cellSize );
					}
					*/
				}
			}
			
			const cw = canv.width;
			const ch = canv.height;
			
			ctx.fillStyle = '#000';
			ctx.fillRect(0, 0, cw, this.clip.minY);
			ctx.fillRect(0             , this.clip.minY, this.clip.minX, this.clip.height);
			ctx.fillRect(this.clip.maxX, this.clip.minY, cw - this.clip.maxX, this.clip.height );
			ctx.fillRect(0, this.clip.maxY, cw, ch - this.clip.maxY);
		}, this.focusDistance - 0.5 );
		
		this.flushDrawCommands();
	}
	
	public clear() {
		if( !this._canvas || !this.canvasContext ) {
			console.log("No canvas; nothing to clear");
			return;
		}
		this.canvasContext.clearRect(0,0,this._canvas.width,this._canvas.height);
	}
	
	public canvasToWorldCoordinates(x:number, y:number, focusZ:number=this.focusDistance, dest:Vector3D=new Vector3D ):Vector3D {
		const pdx = x - this.screenCenterX, pdy = y - this.screenCenterY;
		const ppm = this.unitPpm / focusZ;
		return dest.set( pdx/ppm, pdy/ppm, 0 );
	}
}
