import Vector3D from './Vector3D';
import { makeVector, setVector, vectorToArray, ZERO_VECTOR } from './vector3ds';
import { scaleVector } from './vector3dmath';
import Quaternion from './Quaternion';
import AABB from './AABB';
import { makeAabb, aabbWidth, aabbHeight, aabbDepth } from './aabbs';
import { Room, RoomEntity, Entity, EntityClass, StructureType, TileTree, TileEntityPalette } from './world';
import GameDataManager from './GameDataManager';
import { deepFreeze } from './DeepFreezer';
import { hash, sha1Urn, base32Encode } from '../tshash/index';
import SHA1 from '../tshash/SHA1';
import { coalesce2 } from './util';

const posBuffer0:Vector3D = makeVector();

function toArray<T,D extends ArrayLike<T>>(src:ArrayLike<T>, dest:D):D {
	for( let i=0; i < src.length; ++i ) (<any>dest)[i] = src[i];
	return dest;
}
function toUint8Array(src:ArrayLike<number>):Uint8Array {
	return toArray(src, new Uint8Array(src.length));
}

function entityClassRef( op:any, gdm?:GameDataManager ):string {
	if( typeof op == 'string' ) return op;
	
	if( gdm == null ) throw new Error("Can't generate object prototype ref without GameDataManager");
	
	return gdm.fastStoreObject(op);
}

/**
 * Palette can either be an ID of a TileEntityPalette,
 * or a list of tile tree entity class refs.
 */
export function makeTileEntityPaletteRef( palette:any, gdm?:GameDataManager, alias?:string ):string {
	if( typeof palette == 'string' ) return palette;
	
	if( gdm == null ) throw new Error("Can't generate palette ref without GameDataManager");
	
	if( !Array.isArray(palette) ) throw new Error("Supposed tile palette is not an array; can't reference it: "+JSON.stringify(palette));
	
	const tilePalette:TileEntityPalette = palette.map( (obj:any) => obj == null ? null : deepFreeze({
		orientation: Quaternion.IDENTITY, // For now
		entity: {
			classRef: entityClassRef(obj, gdm)
		},
	}) );

	return gdm.fastStoreObject(tilePalette, alias);
}

/**
 * It is safe to pass posBuffer = pos
 * so long as you don't rely on that buffer
 * calling eachSubEntity.
 */
export function eachSubEntity<T>(
	entity:Entity, pos:Vector3D, gdm:GameDataManager,
	callback:(subEnt:Entity, pos:Vector3D, orientation:Quaternion)=>T|undefined,
	callbackThis:any=null, posBuffer:Vector3D=posBuffer0
):T|undefined {
	const proto = gdm.getObject<EntityClass>(entity.classRef);
	if( proto == null ) throw new Error("Failed to get entity class "+entity.classRef);
	
	if( proto.structureType == StructureType.NONE ) {
	} else if( proto.structureType == StructureType.INDIVIDUAL ) {
		// No sub-objects!
	} else if( proto.structureType == StructureType.TILE_TREE ) {
		const tt:TileTree = <TileTree>proto;
		const tilePaletteIndexes = tt.childEntityIndexes;
		const tilePalette = gdm.getObject<TileEntityPalette>(tt.childEntityPaletteRef);
		if( tilePalette == null ) return;
		const xd = aabbWidth( tt.tilingBoundingBox)/tt.xDivisions;
		const yd = aabbHeight(tt.tilingBoundingBox)/tt.yDivisions;
		const zd = aabbDepth( tt.tilingBoundingBox)/tt.zDivisions;
		const x0 = pos.x - aabbWidth( tt.tilingBoundingBox)/2 + xd/2;
		const y0 = pos.y - aabbHeight(tt.tilingBoundingBox)/2 + yd/2;
		const z0 = pos.z - aabbDepth( tt.tilingBoundingBox)/2 + zd/2;
		for( let i=0, z=0; z < tt.zDivisions; ++z ) for( let y=0; y < tt.yDivisions; ++y ) for( let x=0; x < tt.xDivisions; ++x, ++i ) {
			const tileEntity = tilePalette[tilePaletteIndexes[i]];
			if( tileEntity != null ) {
				let v = callback.call( callbackThis, tileEntity.entity, setVector(posBuffer, x0+x*xd, y0+y*yd, z0+z*zd), tileEntity.orientation );
				if( v != null ) return v;
			}
		}
	} else {
		throw new Error("Unrecognized physical object type: "+proto.structureType);
	}
	return undefined;
}

export function makeTileTreeNode( palette:any, w:number, h:number, d:number, indexes:number[], gdm:GameDataManager, opts:MakeTileTreeOptions={} ):TileTree {
	if( indexes.length != w*h*d ) {
		throw new Error("Expected 'indexes' to be array of length "+(w*d*h)+"; but it had length "+indexes.length);
	}
	const _paletteRef = makeTileEntityPaletteRef(palette, gdm);
	
	const tilePalette = gdm.getObject<TileEntityPalette>(_paletteRef);
	if( tilePalette == null ) throw new Error("Failed to get tile palette "+_paletteRef);
	let tileW = 0, tileH = 0, tileD = 0;
	for( let t in tilePalette ) {
		const tileEntity = tilePalette[t];
		if( tileEntity == null ) continue;
		if( tileEntity.entity == null ) throw new Error("TileEntity#entity is null!");
		const tileClassRef = tileEntity.entity.classRef;
		const tileClass = gdm.getObject<EntityClass>(tileClassRef);
		if( tileClass == null ) throw new Error("Couldn't find entity class "+tileClassRef+" while calculating size for tile tree; given palette: "+JSON.stringify(palette)+"; "+JSON.stringify(tilePalette));
		tileW = Math.max(aabbWidth( tileClass.tilingBoundingBox), tileW);
		tileH = Math.max(aabbHeight(tileClass.tilingBoundingBox), tileH);
		tileD = Math.max(aabbDepth( tileClass.tilingBoundingBox) , tileD);
	}

	let totalOpacity:number = 0;
	let isCompletelyUnsolid:boolean = true;
	let isCompletelySolid:boolean = true;
	let totalMass:number = 0;
	for( let i = w*d*h-1; i >= 0; --i ) {
		const tileEntity = tilePalette[indexes[i]];
		if( tileEntity == null ) continue;
		if( tileEntity.entity.classRef == null ) continue;
		const tileClass = gdm.getObject<EntityClass>(tileEntity.entity.classRef);
		if( tileClass == null ) throw new Error("Failed to get tile class "+tileEntity.entity.classRef);
		totalOpacity += tileClass.opacity ? tileClass.opacity : 0;
		if( tileClass.isSolid === true ) isCompletelyUnsolid = false;
		if( tileClass.isSolid === false ) isCompletelySolid = false;
		totalMass += tileClass.mass == null ? Infinity : tileClass.mass;
	}
	
	const tilingBoundingBox = makeAabb(-tileW*w/2, -tileH*h/2, -tileD*d/2, +tileW*w/2, +tileH*h/2, +tileD*d/2);
	
	return {
		visualBoundingBox: tilingBoundingBox, // TODO: potentially different!
		physicalBoundingBox: tilingBoundingBox, // TODO: potentially different!
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: tilingBoundingBox,
		xDivisions: w,
		yDivisions: h,
		zDivisions: d,
		childEntityPaletteRef: _paletteRef,
		childEntityIndexes: indexes,
		isSolid: isCompletelyUnsolid ? false : isCompletelySolid ? true : undefined,
		mass: opts.infiniteMass ? Infinity : totalMass,
		// These don't really make sense to have to have on a tile tree
		// isAffectedByGravity: false,
		// visualRef: undefined,
		opacity: totalOpacity/(w*h*d),
	}
}

export interface MakeTileTreeOptions {
	/** If set, make the tile tree mass = infinity, even if child nodes are not */
	infiniteMass? : boolean;
}

export function makeTileTreeRef( palette:any, w:number, h:number, d:number, indexes:any, gdm:GameDataManager, opts:MakeTileTreeOptions={}, alias?:string ):string {
	const tt:TileTree = makeTileTreeNode(palette, w, h, d, indexes, gdm, opts);
	return gdm.fastStoreObject(tt, alias);
}

export function connectRooms( gdm:GameDataManager, room0Ref:string, room1Ref:string, offset:Vector3D ):void {
	offset = deepFreeze(offset);
	const room0 = gdm.getRoom(room0Ref);
	if( room0 == null ) throw new Error("Failed to get room "+room0Ref);
	const room1 = gdm.getRoom(room1Ref);
	if( room1 == null ) throw new Error("Failed to get room "+room1Ref);
	const neighborKey0To1 = "n"+base32Encode(hash(room0Ref+";"+room1Ref+";"+vectorToArray(offset).join(","), SHA1));
	const neighborKey1To0 = "n"+base32Encode(hash(room1Ref+";"+room0Ref+";"+vectorToArray(scaleVector(offset, -1)).join(","), SHA1));
	room0.neighbors[neighborKey0To1] = {
		offset: offset,
		roomRef: room1Ref,
		bounds: room1.bounds,
	}
	room1.neighbors[neighborKey1To0] = {
		offset: scaleVector(offset, -1),
		roomRef: room0Ref,
		bounds: room0.bounds,
	}
}

export function roomEntityVelocity(re:RoomEntity):Vector3D {
	return coalesce2(re.velocity, ZERO_VECTOR);
}
export function roomEntityOrientation(re:RoomEntity):Quaternion {
	return coalesce2(re.orientation, Quaternion.IDENTITY);
}
