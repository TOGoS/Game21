import { clone } from './DeepFreezer';
import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import { makeVector, setVector, vectorToString, ZERO_VECTOR } from './vector3ds';
import { addVector, subtractVector, vectorLength, vectorIsZero, scaleVector, normalizeVector, roundVectorToGrid } from './vector3dmath';
import AABB from './AABB';
import {
	makeAabb, setAabb, aabbWidth, aabbHeight, aabbDepth,
	aabbAverageX, aabbAverageY, aabbContainsVector, aabbIntersectsWithOffset,
	UNBOUNDED_AABB
} from './aabbs';
import GameDataManager from './GameDataManager';
import { StructureType, Entity, EntityClass, TileTree, TileEntity, TileEntityPalette } from './world';

/**
 * tileAabb is relative to tilePos.
 */
export type TileTreeRewriteFunction = (
	tilePos:Vector3D, tileAabb:AABB, index:number, e:TileEntity|null|undefined
) => number|TileEntity|string|null;

class TileEntityPaletteManager {
	protected _palette:TileEntityPalette|undefined;
	protected _paletteRef:string|undefined;
	public constructor( paletteRef:string, protected gdm:GameDataManager ) {
		this._paletteRef = paletteRef;
	}
	public get palette():TileEntityPalette {
		if( this._palette == null ) {
			if( this._paletteRef == null ) throw new Error("Can't fetch palette without ref!");
			this._palette = this.gdm.getObject<TileEntityPalette>(this._paletteRef);
		}
		return this._palette;
	}
	public get paletteRef():string {
		if( this._paletteRef == null ) {
			if( this._palette == null ) throw new Error("Can't calculate palette ref without palette!");
			Object.freeze(this._palette);
			this._paletteRef = this.gdm.tempStoreObject<TileEntityPalette>(this._palette);
		}
		return this._paletteRef;
	}
	protected addTileEntity( te:TileEntity|null ):number {
		let pal = this.palette;
		this._paletteRef = undefined;
		if( Object.isFrozen(pal) ) {
			const newPal:TileEntityPalette = new Array<TileEntity>(pal.length);
			for( let i=0; i<pal.length; ++i ) newPal[i] = pal[i];
			pal = newPal;
		}
		pal.push(te);
		this._palette = pal;
		return pal.length-1;
	}
	// TODO: Not obvious that this adds new ones when not found; maybe make 'addIfNotFound:boolean=false' parameter.
	public findTileEntity( te:TileEntity|null ):number {
		const pal = this.palette;
		for( let i=0; i<pal.length; ++i ) {
			const palE = pal[i];
			if( te == null && palE == null ) return i;
			if( te != null && palE != null ) {
				if( palE.entity.classRef == te.entity.classRef ) {
					// Good enough for now; we'll ignore other properties
					return i;
				}
			}
		}
		return this.addTileEntity(te);
	}
}

const ttRewritePos = makeVector();
const ttRewriteAabb = makeAabb(0,0,0,0,0,0);
export function rewriteTileTreeIntersecting(
	pos:Vector3D, ttRef:string,
	bbPos:Vector3D, bb:AABB,
	rewrite:TileTreeRewriteFunction,
	gdm:GameDataManager
):string {
	// Eventually should define rewrite function to allow returning
	// new TileEntity and create a new palette if needed.
	const entityClass = gdm.getEntityClass(ttRef);
	if( entityClass.structureType != StructureType.TILE_TREE ) {
		throw new Error("Can't rewrite "+entityClass+"; not a tile tree!");
	}
	
	const tt = <TileTree>entityClass;
	const tepm = new TileEntityPaletteManager(tt.childEntityPaletteRef, gdm);
	
	const ttBb = tt.tilingBoundingBox;
	const zDivs = tt.zDivisions, yDivs = tt.yDivisions, xDivs = tt.xDivisions;
	const ttWidth = ttBb.maxX-ttBb.minX, ttHeight = ttBb.maxY-ttBb.minY, ttDepth = ttBb.maxZ-ttBb.minZ;
	const xd = ttWidth/xDivs, yd = ttHeight/yDivs, zd = ttDepth/zDivs;
	const halfZd = zd/2, halfXd = xd/2, halfYd = yd/2;
	
	// Tile tree corners, adjusted by pos:
	const x0 = pos.x + ttBb.minX, x1 = pos.x + ttBb.maxX;
	const y0 = pos.y + ttBb.minY, y1 = pos.y + ttBb.maxY;
	const z0 = pos.z + ttBb.minZ, z1 = pos.z + ttBb.maxZ;
	const bbMinX = bbPos.x+bb.minX, bbMaxX = bbPos.x+bb.maxX;
	const bbMinY = bbPos.y+bb.minY, bbMaxY = bbPos.y+bb.maxY;
	const bbMinZ = bbPos.z+bb.minZ, bbMaxZ = bbPos.z+bb.maxZ;
	
	// Slice/row/cell numbers that intersect the bounding box
	const cx0 = bbMinX <= x0 ? 0 : bbMinX >= x1 ? xDivs : Math.floor((bbMinX-x0)/xd);
	const cx1 = bbMaxX <= x0 ? 0 : bbMaxX >= x1 ? xDivs : Math.ceil( (bbMaxX-x0)/xd);
	const cy0 = bbMinY <= y0 ? 0 : bbMinY >= y1 ? yDivs : Math.floor((bbMinY-y0)/yd);
	const cy1 = bbMaxY <= y0 ? 0 : bbMaxY >= y1 ? yDivs : Math.ceil( (bbMaxY-y0)/yd);
	const cz0 = bbMinZ <= z0 ? 0 : bbMinZ >= z1 ? zDivs : Math.floor((bbMinZ-z0)/zd);
	const cz1 = bbMaxZ <= z0 ? 0 : bbMaxZ >= z1 ? zDivs : Math.ceil( (bbMaxZ-z0)/zd);
	
	const pal = tepm.palette;
	const indexes = tt.childEntityIndexes;
	let newIndexes = indexes;
	setAabb(ttRewriteAabb, -xd/2, -yd/2, -zd/2, +xd/2, +yd/2, +zd/2);
	
	for( let cz=cz0; cz < cz1; ++cz ) {
		const subZ = z0+cz*zd+halfZd;
		for( let cy=cy0; cy < cy1; ++cy ) {
			const subY = y0+cy*yd+halfYd;
			for( let cx=cx0, i=cx+(cy*xDivs)+(cz*xDivs*yDivs); cx < cx1; ++cx, ++i ) {
				let tileIndex = indexes[i];
				setVector(ttRewritePos, x0+(cx+0.5)*xd, y0+(cy+0.5)*yd, z0+(cz+0.5)*zd);
				let newIndex = rewrite(ttRewritePos, ttRewriteAabb, tileIndex, pal[tileIndex]);
				if( newIndex === tileIndex ) continue; // Shortcut when obviosuly no change.
				
				if( typeof newIndex == 'string' ) {
					newIndex = tepm.findTileEntity( {entity: {classRef:newIndex}, orientation: Quaternion.IDENTITY} );
				} else if( typeof newIndex == 'object' ) {
					newIndex = tepm.findTileEntity( <TileEntity>newIndex );
				}
				// TODO: some special value to indicate 'recurse'
				if( typeof newIndex != 'number' ) {
					throw new Error('non-number return value from rewrite function not yet supported');
				}
				if( newIndex != tileIndex ) {
					if( newIndexes === indexes ) {
						// Clone it
						const size = tt.xDivisions*tt.yDivisions*tt.zDivisions;
						newIndexes = new Array<number>(size);
						for( let j=0; j<size; ++j ) newIndexes[j] = indexes[j];
					}
					newIndexes[i] = newIndex;
				}
			}
		}
	}
	
	if( newIndexes === indexes ) {
		// No changes, ha ha ha!
		return ttRef;
	} else {
		const newTt = clone(tt);
		newTt.childEntityIndexes = newIndexes;
		newTt.childEntityPaletteRef = tepm.paletteRef;
		return gdm.tempStoreObject<TileTree>(newTt);
	}
}

export function rewriteTileTree(
	ttPos:Vector3D, ttRef:string,
	rewrite:TileTreeRewriteFunction,
	gdm:GameDataManager
):string {
	return rewriteTileTreeIntersecting(
		ttPos, ttRef, ZERO_VECTOR, UNBOUNDED_AABB, rewrite, gdm
	);
}