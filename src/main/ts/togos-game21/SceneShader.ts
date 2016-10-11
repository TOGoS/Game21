import Vector3D from './Vector3D';
import { makeVector } from './vector3ds';
import { addVector } from './vector3dmath';
import Quaternion from './Quaternion';
import Rectangle, {RectangularBounds} from './Rectangle';
import Cuboid from './Cuboid';
import { eachSubEntity, roomEntityOrientation } from './worldutil';
import { Room, RoomEntity, Entity, EntityClass, StructureType, TileTree } from './world';
import GameDataManager from './GameDataManager';

export const OPACITY_TRANSPARENT =   0;
export const OPACITY_OPAQUE      = 254;
export const OPACITY_VOID        = 255; // Void space!  Even more opaque than opaque.

export const VISIBILITY_VOID =   0; // Void space!  Even less visible than none.
export const VISIBILITY_NONE =   1; // Invisible due to opaqueness
export const VISIBILITY_MIN  =   2; // Minimum visiblity for actually seeing something at all
export const VISIBILITY_MAX  = 255; // Very visible

/*
 * Opactity map gives opacity of each cell
 * 
 * Shade map gives visibility of each cell corner
 */

export class ShadeRaster {
	public data:Uint8Array;
	
	/**
	 * originX and originY are the location of the map's origin relative to its top-left corner in world units
	 * width and height are in samples
	 * resolution = samples per meter; higher means the size of the thing is smaller
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
		dest.maxX = this.width /this.resolution - this.originX;
		dest.maxY = this.height/this.resolution - this.originY;
		return dest;
	}
}

const mapBoundsBuffer:Cuboid = new Cuboid;
const roomPosBuf:Vector3D = makeVector();
const objPosBuf:Vector3D = makeVector();
const objBB = new Cuboid;

const plax = function<T>(dx0:any,dy0:any,dx1:any,dy1:any,a:T,b:T):T {
	return dx0 == dx1 && dy0 == dy1 ? a : b;
}

export default class SceneShader {
	public constructor( protected gameDataManager:GameDataManager ) { } 

	public shareMap( opacityMap:ShadeRaster, dest:ShadeRaster ):ShadeRaster {
		dest.data.fill(0);
		return dest;
	}
	
	// 'implicitly passed variables'
	protected destShadeMap:ShadeRaster;
	protected destBounds:Cuboid = new Cuboid;
	
	protected applyObjectToOpacityRaster( ent:Entity, pos:Vector3D, orientation:Quaternion ):void {
		const proto = <EntityClass>this.gameDataManager.getObject(ent.classRef);
		if( !proto ) return; // Well, maybe we should just mark everything opaque!
		const vbb = proto.visualBoundingBox;
		const destBounds = this.destBounds;
		if( pos.x + vbb.maxX <= destBounds.minX ) return;
		if( pos.y + vbb.maxY <= destBounds.minY ) return;
		if( pos.x + vbb.minX >= destBounds.maxX ) return;
		if( pos.y + vbb.minY >= destBounds.maxY ) return;
		if( pos.z + vbb.maxZ <= destBounds.minZ ) return;
		
		if( proto.opacity === 0 ) return;
		
		if( proto.structureType == StructureType.INDIVIDUAL && proto.opacity != null ) {
			const destMap = this.destShadeMap;
			const opacityByte = Math.round(255*proto.opacity); 
			// Round object's corners to nearest opacity raster cell corners.
			// (this should have the effect that any cell whose center is covered by the object gets marked opaque)
			const minCX = Math.max(0             , Math.round( (vbb.minX + pos.x + destMap.originX) * destMap.resolution));
			const minCY = Math.max(0             , Math.round( (vbb.minY + pos.y + destMap.originY) * destMap.resolution));
			const maxCX = Math.min(destMap.width , Math.round( (vbb.maxX + pos.x + destMap.originX) * destMap.resolution));
			const maxCY = Math.min(destMap.height, Math.round( (vbb.maxY + pos.y + destMap.originY) * destMap.resolution));
			for( let cy = minCY; cy < maxCY; ++cy ) {
				for( let cx = minCX, ci = cy*destMap.width + cx; cx < maxCX; ++cx, ++ci ) {
					const currentOpacity:number = destMap.data[ci] / 255;
					const combinedOpacity:number = currentOpacity + (1-currentOpacity) * proto.opacity;
					destMap.data[ci] = Math.round( OPACITY_OPAQUE * combinedOpacity );
				} 
			}
			return;
		}
		
		eachSubEntity(ent, pos, this.gameDataManager, this.applyObjectToOpacityRaster, this);
	}
	
	/**
	 * Pos = position relative to the shademap's origin where this room's origin would appear
	 */
	protected applyRoomToOpacityRaster( room:Room, pos:Vector3D ):void {
		{
			// Set opacity of room area to zero
			const destMap = this.destShadeMap;
			const destData = destMap.data;
			const tbb = room.bounds;
			const minCX = Math.max(0             , Math.round( (tbb.minX + pos.x + destMap.originX) * destMap.resolution));
			const minCY = Math.max(0             , Math.round( (tbb.minY + pos.y + destMap.originY) * destMap.resolution));
			const maxCX = Math.min(destMap.width , Math.round( (tbb.maxX + pos.x + destMap.originX) * destMap.resolution));
			const maxCY = Math.min(destMap.height, Math.round( (tbb.maxY + pos.y + destMap.originY) * destMap.resolution));
			for( let y=minCY; y<maxCY; ++y ) for( let x=minCX, i=y*destMap.width+x; x<maxCX; ++x, ++i ) {
				destData[i] = OPACITY_TRANSPARENT;
			}
		}

		for( let e in room.roomEntities ) {
			const re = room.roomEntities[e];
			const ent = re.entity;
			addVector(pos, re.position, objPosBuf);
			// If we really cared about orientation (and assuming rooms can have them),
			// we'd do the same thing to it.
			this.applyObjectToOpacityRaster( ent, objPosBuf, roomEntityOrientation(re) );
		}
	}
	
	public sceneOpacityRaster( roomRef:string, roomPos:Vector3D, dest:ShadeRaster ):ShadeRaster {
		dest.data.fill(OPACITY_VOID);
		
		this.destShadeMap = dest;
		dest.getBounds(this.destBounds);
		this.destBounds.minZ = -0.5;
		this.destBounds.maxZ = +0.5;
		
		const room = this.gameDataManager.getRoom(roomRef);
		if( room == null ) return dest;
		this.applyRoomToOpacityRaster(room, roomPos);
		for( const n in room.neighbors ) {
			const neighbor = room.neighbors[n];
			const neighbR = this.gameDataManager.getObject<Room>(neighbor.roomRef);
			if( neighbR == null ) continue;
			addVector(roomPos, neighbor.offset, roomPosBuf);
			this.applyRoomToOpacityRaster(neighbR, roomPosBuf);
		}
		
		return dest;
	}
	
	/**
	 * Fill dest with zeroes and then call this
	 * for each cell with eyes.
	 */
	public opacityTolVisibilityRaster2( opacity:ShadeRaster, x:number, y:number, dx:number, dy:number, maxDistance:number, dest:ShadeRaster ):void {
		if( maxDistance <= VISIBILITY_NONE ) return;
		if( x < 0 || y < 0 || x >= opacity.width || y >= opacity.height ) return;
		x |= 0; y |= 0;
		
		if( maxDistance > VISIBILITY_MAX ) maxDistance = VISIBILITY_MAX;
		const idx = x+y*opacity.width;
		const od = opacity.data[idx];
		if( od >= OPACITY_VOID ) return;
		maxDistance = VISIBILITY_NONE + Math.floor( (maxDistance-VISIBILITY_NONE) * (OPACITY_OPAQUE-od)/OPACITY_OPAQUE);
		if( maxDistance > dest.data[idx] ) {
			dest.data[idx] = maxDistance;
			if( maxDistance >= VISIBILITY_MIN ) {
				const ndA = maxDistance - 1;
				const ndB = (dx == 0 && dy == 0) ? ndA : Math.floor(maxDistance/2);
				this.opacityTolVisibilityRaster2( opacity, x+1, y+0, +1,  0, plax(+1, 0,dx,dy,ndA,ndB), dest );
				this.opacityTolVisibilityRaster2( opacity, x+0, y+1,  0, +1, plax( 0,+1,dx,dy,ndA,ndB), dest );
				this.opacityTolVisibilityRaster2( opacity, x-1, y+0, -1,  0, plax(-1, 0,dx,dy,ndA,ndB), dest );
				this.opacityTolVisibilityRaster2( opacity, x+0, y-1,  0, -1, plax( 0,-1,dx,dy,ndA,ndB), dest );
			}
		}
	}
	
	public initializeVisibilityRaster( opacity:ShadeRaster, dest:ShadeRaster, opaqueVisibility:number=VISIBILITY_NONE ):void {
		if( dest.width != opacity.width || dest.height != opacity.height ) {
			throw new Error("Opacity and destination visibility rasters must have the same dimensions; given "+
				opacity.width+"x"+opacity.height+" and "+dest.width+"x"+dest.height);
		}
		// Translate voidness to visibility raster
		const opDat = opacity.data, destDat = dest.data;
		for( let i=opacity.width*opacity.height-1; i>=0; --i ) {
			destDat[i] = opDat[i] == OPACITY_VOID ? VISIBILITY_VOID : opaqueVisibility;
		}
	}
	
	public opacityTolVisibilityRaster( opacity:ShadeRaster, x:number, y:number, maxDistance:number, dest:ShadeRaster ):void {
		this.opacityTolVisibilityRaster2( opacity, x, y, 0, 0, maxDistance, dest );
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

	/**
	 * Expand visibility by one sample in every direction (including diagonals);
	 * Useful if you're working directly from the visibility raster
	 * for determining object visibility instead of converting to a shade raster.
	 */
	public growVisibility( visibility:ShadeRaster ):void {
		const dat = visibility.data;
		const w = visibility.width;
		const h = visibility.height;
		
		// Increase the value of any cells with visibility=NONE
		// to MIN if they have any neighbor with visibility>MIN.
		// Spread horizontally:
		for( let i=0, y=0; y<h; ++y ) for( let prevVal=0, x=0; x<w; ++x, ++i ) {
			if( dat[i] == VISIBILITY_NONE ) {
				if( prevVal >= VISIBILITY_MIN || x < w-1 && dat[i+1] >= VISIBILITY_MIN ) {
					dat[i] = VISIBILITY_MIN;
				}
				prevVal = VISIBILITY_NONE; // The original value of this cell, not the new one
			} else {
				prevVal = dat[i];
			}
		}
		// Spread vertically:
		for( let x=0; x<w; ++x ) for( let prevVal=0, y=0; y<h; ++y ) {
			const i = y*w+x;
			if( dat[i] == VISIBILITY_NONE ) {
				if( prevVal >= VISIBILITY_MIN || y < h-1 && dat[i+w] >= VISIBILITY_MIN ) {
					dat[i] = VISIBILITY_MIN;
				}
				prevVal = VISIBILITY_NONE; // The original value of this cell, not the new one
			} else {
				prevVal = dat[i];
			}
		}
	}
}
