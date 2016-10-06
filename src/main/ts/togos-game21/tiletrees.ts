import { clone } from './DeepFreezer';
import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import { makeVector, setVector, vectorToString, ZERO_VECTOR } from './vector3ds';
import { addVector, subtractVector, vectorLength, vectorIsZero, scaleVector, normalizeVector, roundVectorToGrid } from './vector3dmath';
import AABB from './AABB';
import {
	makeAabb, setAabb, aabbWidth, aabbHeight, aabbDepth,
	aabbAverageX, aabbAverageY, aabbContainsVector, aabbIntersectsWithOffset
} from './aabbs';
import GameDataManager from './GameDataManager';
import { StructureType, Entity, EntityClass, TileTree, TileEntity, TileEntityPalette } from './world';

export type TileTreeRewriteFunction = (
	pos:Vector3D, aabb:AABB, index:number, e:TileEntity|null|undefined
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
export function rewriteTileTree(
	ttPos:Vector3D, ttRef:string,
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
	const pal = tepm.palette;
	const cellWidth  = aabbWidth( ttBb)/tt.xDivisions;
	const cellHeight = aabbHeight(ttBb)/tt.yDivisions;
	const cellDepth  = aabbDepth( ttBb)/tt.zDivisions;
	const minX = ttPos.x+ttBb.minX, minY = ttPos.y+ttBb.minY, minZ = ttPos.z+ttBb.minZ;
	const indexes = tt.childEntityIndexes;
	let newIndexes = indexes;
	for( let i=0, z=0; z<tt.zDivisions; ++z ) {
		for( let y=0; y<tt.yDivisions; ++y ) {
			for( let x=0; x<tt.xDivisions; ++x, ++i ) {
				let tileIndex = indexes[i];
				setVector(ttRewritePos, minX+(x+0.5)*cellWidth, minY+(y+0.5)*cellHeight, minZ+(z+0.5)*cellDepth);
				setAabb(ttRewriteAabb,
					minX+    x*cellWidth, minY+    y*cellHeight, minZ+    z*cellDepth,
					minX+(x+1)*cellWidth, minY+(y+1)*cellHeight, minZ+(z+1)*cellDepth);
				let newIndex = rewrite(ttRewritePos, ttRewriteAabb, tileIndex, pal[tileIndex]);
				if( typeof newIndex == 'string' ) {
					newIndex = tepm.findTileEntity( {entity: {classRef:newIndex}, orientation: Quaternion.IDENTITY} );
				} else if( typeof newIndex == 'object' ) {
					newIndex = tepm.findTileEntity( <TileEntity>newIndex );
				}
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
		return ttRef;
	} else {
		const newTt = clone(tt);
		newTt.childEntityIndexes = newIndexes;
		newTt.childEntityPaletteRef = tepm.paletteRef;
		return gdm.tempStoreObject<TileTree>(newTt);
	}
}
