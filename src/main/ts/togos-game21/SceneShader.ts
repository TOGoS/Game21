import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import Rectangle, {RectangularBounds} from './Rectangle';
import Cuboid from './Cuboid';
import { eachSubEntity, roomEntityOrientation } from './worldutil';
import { Room, RoomEntity, Entity, EntityClass, StructureType, TileTree } from './world';
import GameDataManager from './GameDataManager';

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
		if( pos.x + vbb.minY >= destBounds.maxY ) return;
		if( pos.z + vbb.maxZ <= destBounds.minZ ) return;
		
		if( proto.opacity != null && proto.opacity == 1 ) {
			const destMap = this.destShadeMap;
			const tbb = proto.tilingBoundingBox;
			const opacityByte = Math.round(255*proto.opacity); 
			// Round object's corners to nearest opacity raster cell corners.
			// (this should have the effect that any cell whose center is covered by the object gets marked opaque)
			const minCX = Math.max(0             , Math.round( (tbb.minX + pos.x + destMap.originX) * destMap.resolution));
			const minCY = Math.max(0             , Math.round( (tbb.minY + pos.y + destMap.originY) * destMap.resolution));
			const maxCX = Math.min(destMap.width , Math.round( (tbb.maxX + pos.x + destMap.originX) * destMap.resolution));
			const maxCY = Math.min(destMap.height, Math.round( (tbb.maxY + pos.y + destMap.originY) * destMap.resolution));
			for( let cy = minCY; cy < maxCY; ++cy ) {
				for( let cx = minCX, ci = cy*destMap.width + cx; cx < maxCX; ++cx, ++ci ) {
					const currentOpacityByte = destMap.data[ci];
					// TODO: Probably better to avoid the ifs and just always do the fancy arithmetic
					if( currentOpacityByte == 255 ) continue;
					if( currentOpacityByte == 0 ) {
						destMap.data[ci] = opacityByte;
					} else {
						// Slightly more complicated combination arithmetic
						const currentOpacity:number = destMap.data[ci] / 255;
						const combinedOpacity:number = currentOpacity + (1-currentOpacity) * proto.opacity;
						destMap.data[ci] = Math.round( 255 * combinedOpacity );
					}
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
		for( let e in room.roomEntities ) {
			const re = room.roomEntities[e];
			const ent = re.entity;
			Vector3D.add(pos, re.position, objPosBuf);
			// If we really cared about orientation (and assuming rooms can have them),
			// we'd do the same thing to it.
			this.applyObjectToOpacityRaster( ent, objPosBuf, roomEntityOrientation(re) );
		}
	}
	
	public sceneOpacityRaster( roomRef:string, roomPos:Vector3D, dest:ShadeRaster ):ShadeRaster {
		// TODO: fill with opaque, then carve out rooms, then add opacity of objects
		dest.data.fill(0);
		
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
			Vector3D.add(roomPos, neighbor.offset, roomPosBuf);
			this.applyRoomToOpacityRaster(neighbR, roomPosBuf);
		}
		
		return dest;
	}
	
	// Naive recursion was too slow so optimize by shooting in straight lines
	/*
	TODO: Fix these functions to not be wrong
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
	*/
	
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
				this.opacityTolVisibilityRaster( opacity, x+1, y+0, maxDistanceMinus1, dest );
				this.opacityTolVisibilityRaster( opacity, x+0, y+1, maxDistanceMinus1, dest );
				this.opacityTolVisibilityRaster( opacity, x-1, y+0, maxDistanceMinus1, dest );
				this.opacityTolVisibilityRaster( opacity, x+0, y-1, maxDistanceMinus1, dest );
				/*
				this.opacityTolVisibilityRasterOptX( opacity, x+1, y  , maxDistanceMinus1, dest, +1 );
				this.opacityTolVisibilityRasterOptY( opacity, x  , y+1, maxDistanceMinus1, dest, +1 );
				this.opacityTolVisibilityRasterOptX( opacity, x-1, y  , maxDistanceMinus1, dest, -1 );
				this.opacityTolVisibilityRasterOptY( opacity, x  , y-1, maxDistanceMinus1, dest, -1 );
				*/
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

	/**
	 * Expand visibility by one sample in every direction (including diagonals);
	 * Useful if you're working directly from the visibility raster
	 * for determining object visibility instead of converting to a shade raster.
	 */
	public growVisibility( visibility:ShadeRaster ):void {
		const dat = visibility.data;
		const w = visibility.width;
		const h = visibility.height;
		for( let i=0, y=0; y<h; ++y ) for( let x=0; x<w; ++x, ++i ) {
			if( dat[i] > 0 && dat[i] < 255 ) ++dat[i];
		}
		for( let i=0, y=0; y<h; ++y ) for( let prevVal=0, x=0; x<w; ++x, ++i ) {
			if( dat[i] == 0 ) {
				if( prevVal || x < w-1 && dat[i+1] ) {
					dat[i] = 1;
				}
				prevVal = 0;
			} else {
				prevVal = dat[i];
			}
		}
		for( let x=0; x<w; ++x ) for( let prevVal=0, y=0; y<h; ++y ) {
			const i = y*w+x;
			if( dat[i] == 0 ) {
				if( prevVal || y < h-1 && dat[i+w] ) {
					dat[i] = 1;
				}
				prevVal = 0;
			} else {
				prevVal = dat[i];
			}
		}
	}
}
