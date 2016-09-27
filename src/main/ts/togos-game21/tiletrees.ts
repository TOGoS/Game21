import { clone } from './DeepFreezer';
import Vector3D from './Vector3D';
import { makeVector, setVector, vectorToString, ZERO_VECTOR } from './vector3ds';
import { addVector, subtractVector, vectorLength, vectorIsZero, scaleVector, normalizeVector, roundVectorToGrid } from './vector3dmath';
import AABB from './AABB';
import {
	makeAabb, setAabb, aabbWidth, aabbHeight, aabbDepth,
	aabbAverageX, aabbAverageY, aabbContainsVector, aabbIntersectsWithOffset
} from './aabbs';
import GameDataManager from './GameDataManager';
import { StructureType, Entity, EntityClass, TileTree, TileTreeEntity, TileEntityPalette } from './world';

export type TileTreeRewriteFunction = (pos:Vector3D, aabb:AABB, index:number, e:TileTreeEntity|null|undefined)=>number|"recurse";

const ttRewritePos = makeVector();
const ttRewriteAabb = makeAabb(0,0,0,0,0,0);
export function rewriteTileTree(
	ttPos:Vector3D, ttRef:string,
	rewrite:TileTreeRewriteFunction,
	gdm:GameDataManager
):string {
	// Eventually should define rewrite function to allow returning
	// new TileTreeEntity and create a new palette if needed.
	const entityClass = gdm.getEntityClass(ttRef);
	if( entityClass.structureType != StructureType.TILE_TREE ) {
		throw new Error("Can't rewrite "+entityClass+"; not a tile tree!");
	}
	const tt = <TileTree>entityClass;
	const ttBb = tt.tilingBoundingBox;
	const pal = gdm.getObject<TileEntityPalette>(tt.childEntityPaletteRef);
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
				const newIndex = rewrite(ttRewritePos, ttRewriteAabb, tileIndex, pal[tileIndex]);
				if( newIndex != tileIndex ) {
					if( newIndexes === indexes ) {
						// Clone it
						const size = tt.xDivisions*tt.yDivisions*tt.zDivisions;
						newIndexes = new Array<number>(size);
						for( let j=0; j<size; ++j ) newIndexes[j] = indexes[j];
					}
					if( typeof newIndex == 'number' ) {
						newIndexes[i] = newIndex;
					} else {
						throw new Error('non-number return value from rewrite function not yet supported');
					}
				}
			}
		}
	}
	if( newIndexes === indexes ) {
		return ttRef;
	} else {
		const newTt = clone(tt);
		console.log("Rewrote tile tree!", tt, newTt);
		newTt.childEntityIndexes = newIndexes;
		return gdm.fastStoreObject<TileTree>(newTt);
	}
}
