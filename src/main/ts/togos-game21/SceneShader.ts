import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import Rectangle, {RectangularBounds} from './Rectangle';
import Cuboid from './Cuboid';
import { eachSubObject, objectVelocity, objectOrientation } from './worldutil';
import { Game, Room, PhysicalObject, ProtoObject, PhysicalObjectType, TileTree } from './world';

/*
 * Opactity map gives opacity of each cell
 * 
 * Shade map gives visibility of each cell corner
 */

export class ShadeRaster {
	public data:Uint8Array;
	
	/**
	 * originX and originY are the location of the map's origin relative to its top-left corner.
	 */
	constructor(public width:number, public height:number, public resolution:number, public originX:number, public originY:number ) {
		this.data = new Uint8Array(width*height);
	}
	
	/**
	 * If dest is a cuboid, set dest.{min,max}Z as you see fit (-0.5 to +0.5, maybe)
	 */
	public getBounds<T extends RectangularBounds>(dest:T):T {
		dest.minX = -this.originX;
		dest.minY = -this.originY;
		dest.maxX = this.width/this.resolution - this.originX;
		dest.maxY = this.height/this.resolution - this.originY;
		return dest;
	}
}

const mapBoundsBuffer:Cuboid = new Cuboid;
const roomPosBuf:Vector3D = new Vector3D;
const objPosBuf:Vector3D = new Vector3D;
const objBB = new Cuboid;

export default class SceneShader {
	public shareMap( opacityMap:ShadeRaster, dest:ShadeRaster ):ShadeRaster {
		dest.data.fill(0);
		return dest;
	}
	
	// 'implicitly passed variables'
	protected destShadeMap:ShadeRaster;
	protected destBounds:Cuboid = new Cuboid;
	protected game:Game;
	
	// TODO: Move this into GameDataAccessor or something
	protected objectPrototype( obj:PhysicalObject ):ProtoObject {
		const proto = this.game.protoObjects[obj.prototypeRef];
		if( !proto ) throw new Error("No prototype "+obj.prototypeRef );
		return proto;
	}
	
	protected applyObjectToOpacityRaster( proto:ProtoObject, stateFlags:number, pos:Vector3D, orientation:Quaternion ):void {
		const vbb = proto.visualBoundingBox;
		const destBounds = this.destBounds;
		if( pos.x + vbb.maxX <= destBounds.minX ) return;
		if( pos.y + vbb.maxY <= destBounds.minY ) return;
		if( pos.x + vbb.minX >= destBounds.maxX ) return;
		if( pos.x + vbb.minY >= destBounds.maxY ) return;
		if( pos.z + vbb.maxZ <= destBounds.minZ ) return;
		
		if( proto.opacity != null && proto.opacity == 1 ) {
			const destMap = this.destShadeMap;
			const tbb = proto.tilingBoundingBox;
			// It fills its entire tilingBoundingBox, so mark that as opaque!
			// CX/CY = cellX/cellY; i.e. cell x, y, resolution and origin already taken into account.
			const minCX = Math.max(0             , Math.ceil(  (tbb.minX + pos.x + destMap.originX) * destMap.resolution));
			const minCY = Math.max(0             , Math.ceil(  (tbb.minY + pos.y + destMap.originY) * destMap.resolution));
			const maxCX = Math.min(destMap.width , Math.floor( (tbb.maxX + pos.x + destMap.originX) * destMap.resolution));
			const maxCY = Math.min(destMap.height, Math.floor( (tbb.maxY + pos.y + destMap.originY) * destMap.resolution));
			for( let cy = minCY; cy < maxCY; ++cy ) {
				for( let cx = minCX, ci = cy*destMap.width + cx; cx < maxCX; ++cx, ++ci ) {
					destMap.data[ci] = 255;
				} 
			}
			return;
		}
		
		eachSubObject(proto, pos, this.game, this.applyObjectToOpacityRaster, this);
	}
	
	/**
	 * Pos = position relative to the shademap's origin where this room's origin would appear
	 */
	protected applyRoomToOpacityRaster( room:Room, pos:Vector3D, game:Game ):void {
		for( let o in room.objects ) {
			const obj = room.objects[o];
			const proto = this.objectPrototype(obj);			
			Vector3D.add(pos, obj.position, objPosBuf);
			// If we really cared about orientation (and assuming rooms can have them),
			// we'd do the same thing to it.
			this.applyObjectToOpacityRaster( proto, obj.stateFlags, objPosBuf, objectOrientation(obj) );
		}
	}
	
	public sceneOpacityRaster( roomRef:string, roomPos:Vector3D, game:Game, dest:ShadeRaster ):ShadeRaster {
		// TODO: fill with opaque, then carve out rooms, then add opacity of objects
		dest.data.fill(0);
		
		this.game = game;
		this.destShadeMap = dest;
		dest.getBounds(this.destBounds);
		this.destBounds.minZ = -0.5;
		this.destBounds.maxZ = +0.5;
		
		const room = game.rooms[roomRef];
		this.applyRoomToOpacityRaster(room, roomPos, game);
		for( const n in room.neighbors ) {
			const neighbor = room.neighbors[n];
			const neighbR = game.rooms[neighbor.roomRef];
			Vector3D.add(roomPos, neighbor.offset, roomPosBuf);
			this.applyRoomToOpacityRaster(neighbR, roomPosBuf, game);
		}
		
		return dest;
	}
	
	// Naive recursion was too slow so optimize by shooting in straight lines
	
	public opacityTolVisibilityRasterOptX( opacity:ShadeRaster, x:number, y:number, maxDistance:number, dest:ShadeRaster, dx:number ):void {
		if( x < 0 || y < 0 || x >= opacity.width || y >= opacity.height ) return;
		
		if( maxDistance > 255 ) maxDistance = 255;
		const idx = x+y*opacity.width;
		maxDistance = Math.floor( maxDistance * (255-opacity.data[idx])/255);
		while( x >= 0 && x <= opacity.width && maxDistance > dest.data[idx] ) {
			dest.data[idx] = maxDistance;
			--maxDistance;
			this.opacityTolVisibilityRasterOptY( opacity, x  , y+1, maxDistance, dest, +1 );
			this.opacityTolVisibilityRasterOptY( opacity, x  , y-1, maxDistance, dest, -1 );
			x += dx;
		}
	}

	public opacityTolVisibilityRasterOptY( opacity:ShadeRaster, x:number, y:number, maxDistance:number, dest:ShadeRaster, dy:number ):void {
		if( x < 0 || y < 0 || x >= opacity.width || y >= opacity.height ) return;
		
		if( maxDistance > 255 ) maxDistance = 255;
		const idx = x+y*opacity.width;
		maxDistance = Math.floor( maxDistance * (255-opacity.data[idx])/255);
		while( y >= 0 && y <= opacity.height && maxDistance > dest.data[idx] ) {
			dest.data[idx] = maxDistance;
			--maxDistance;
			this.opacityTolVisibilityRasterOptX( opacity, x+1, y  , maxDistance, dest, +1 );
			this.opacityTolVisibilityRasterOptX( opacity, x-1, y  , maxDistance, dest, -1 );
			y += dy;
		}
	}
	
	/**
	 * Fill dest with zeroes and then call this
	 * for each cell with eyes. 
	 */
	public opacityTolVisibilityRaster( opacity:ShadeRaster, x:number, y:number, maxDistance:number, dest:ShadeRaster ):void {
		if( x < 0 || y < 0 || x >= opacity.width || y >= opacity.height ) return;
		
		if( maxDistance > 255 ) maxDistance = 255;
		const idx = x+y*opacity.width;
		maxDistance = Math.floor( maxDistance * (255-opacity.data[idx])/255);
		if( maxDistance > dest.data[idx] ) {
			dest.data[idx] = maxDistance;
			if( maxDistance > 0 ) {
				const maxDistanceMinus1 = maxDistance - 1;
				this.opacityTolVisibilityRasterOptX( opacity, x+1, y  , maxDistanceMinus1, dest, +1 );
				this.opacityTolVisibilityRasterOptY( opacity, x  , y+1, maxDistanceMinus1, dest, +1 );
				this.opacityTolVisibilityRasterOptX( opacity, x-1, y  , maxDistanceMinus1, dest, -1 );
				this.opacityTolVisibilityRasterOptY( opacity, x  , y-1, maxDistanceMinus1, dest, -1 );
			}
		}
	}
	
	/**
	 * 
	 */
	public visibilityToShadeRaster( visibility:ShadeRaster, dest:ShadeRaster ):void {
		const vd = visibility.data;
		const dd = dest.data;
		const width = dest.width;
		const height = dest.height;
		for( let i=0, y=0; y < height; ++y ) {
			for( let x=0; x < width; ++x, ++i ) {
				const vdc = vd[i];
				//let v0 = vdc, v1 = vdc, v2 = vdc, v3 = vdc;
				
				const vdw = x >        0 ? vd[i-1]     : 0;
				const vde = x <  width-1 ? vd[i+1]     : 0;
				const vdn = y >        0 ? vd[i-width] : 0;
				const vds = y < height-1 ? vd[i+width] : 0;
				
				const vdnw = x >       0 ? (y >        0 ? vd[i-width-1] : vdc) : vdn;
				const vdne = x < width-1 ? (y >        0 ? vd[i-width+1] : vdc) : vdn;
				const vdsw = x >       0 ? (y < height-1 ? vd[i+width-1] : vdc) : vds;
				const vdse = x < width-1 ? (y < height-1 ? vd[i+width+1] : vdc) : vds;
				
				const v0 = Math.max(vdc, vdnw, vdn, vdw);
				const v1 = Math.max(vdc, vdne, vdn, vde);
				const v2 = Math.max(vdc, vdsw, vds, vdw);
				const v3 = Math.max(vdc, vdse, vds, vde);
				
				dd[i] = (
					( v0       & 0xC0) |
					((v1 >> 2) & 0x30) |
					((v2 >> 4) & 0x0C) |
					((v3 >> 6) & 0x03)
				);
			}
		}
	}
}
