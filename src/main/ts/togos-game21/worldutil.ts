import Vector3D from './Vector3D';
import { makeVector, setVector, vectorToArray, ZERO_VECTOR } from './vector3ds';
import { scaleVector } from './vector3dmath';
import Quaternion from './Quaternion';
import AABB from './AABB';
import { makeAabb, aabbWidth, aabbHeight, aabbDepth, UNBOUNDED_AABB } from './aabbs';
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
	
	return gdm.tempStoreObject(op);
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

	return gdm.tempStoreObject(tilePalette, alias);
}

/**
 * It is safe to pass posBuffer = pos
 * so long as you don't rely on that buffer
 * calling eachSubEntity.
 */
export function eachSubEntityIntersectingBb<T>(
	entity:Entity, pos:Vector3D,
	bbPos:Vector3D, bb:AABB,
	gdm:GameDataManager,
	callback:(subEnt:Entity, pos:Vector3D, orientation:Quaternion)=>T|undefined,
	callbackThis:any=null, posBuffer:Vector3D|undefined=undefined
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
		
		const ttBb = tt.tilingBoundingBox;
		const zDivs = tt.zDivisions, yDivs = tt.yDivisions, xDivs = tt.xDivisions;
		const ttWidth = ttBb.maxX-ttBb.minX, ttHeight = ttBb.maxY-ttBb.minY, ttDepth = ttBb.maxZ-ttBb.minZ;
		const xd = ttWidth/xDivs, yd = ttHeight/yDivs, zd = ttDepth/zDivs;
		const halfZd = zd/2, halfXd = xd/2, halfYd = yd/2;
		
		// Tile tree corners, adjusted by pos:
		const x0 = pos.x - ttWidth /2, x1 = pos.x + ttWidth /2;
		const y0 = pos.y - ttHeight/2, y1 = pos.y + ttHeight/2;
		const z0 = pos.z - ttDepth /2, z1 = pos.z + ttDepth /2;
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
		
		for( let cz=cz0; cz < cz1; ++cz ) {
			const subZ = z0+cz*zd+halfZd;
			for( let cy=cy0; cy < cy1; ++cy ) {
				const subY = y0+cy*yd+halfYd;
				for( let cx=cx0, i=cx+(cy*xDivs)+(cz*xDivs*yDivs); cx < cx1; ++cx, ++i ) {
					const subX = x0+cx*xd+halfXd;
					const tileEntity = tilePalette[tilePaletteIndexes[i]];
					if( tileEntity != null ) {
						let v = callback.call( callbackThis, tileEntity.entity, setVector(posBuffer, subX, subY, subZ), tileEntity.orientation );
						if( v != null ) return v;
					}
				}
			}
		}
	} else {
		throw new Error("Unrecognized physical object type: "+proto.structureType);
	}
	return undefined;
}

/**
 * It is safe to pass posBuffer = pos
 * so long as you don't rely on that buffer
 * calling eachSubEntity.
 */
export function eachSubEntity<T>(
	entity:Entity, pos:Vector3D, gdm:GameDataManager,
	callback:(subEnt:Entity, pos:Vector3D, orientation:Quaternion)=>T|undefined,
	callbackThis:any=null, posBuffer:Vector3D|undefined=undefined
):T|undefined {
	return eachSubEntityIntersectingBb(
		entity, pos,
		ZERO_VECTOR, UNBOUNDED_AABB,
		gdm, callback, callbackThis, posBuffer
	);
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
	
	return deepFreeze({
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
	});
}

export interface MakeTileTreeOptions {
	/** If set, make the tile tree mass = infinity, even if child nodes are not */
	infiniteMass? : boolean;
}

export function makeTileTreeRef( palette:any, w:number, h:number, d:number, indexes:any, gdm:GameDataManager, opts:MakeTileTreeOptions={}, alias?:string ):string {
	const tt:TileTree = makeTileTreeNode(palette, w, h, d, indexes, gdm, opts);
	return gdm.tempStoreObject(tt, alias);
}

export function roomNeighborKey( room0Ref:string, offset:Vector3D, room1Ref:string ):string {
	return "n"+base32Encode(hash(room0Ref+";"+room1Ref+";"+vectorToArray(offset).join(","), SHA1));
}

export function roomNeighborKeys( room0Ref:string, offset:Vector3D, room1Ref:string ):[string,string] {
	return [
		roomNeighborKey(room0Ref, offset, room1Ref),
		roomNeighborKey(room1Ref, scaleVector(offset, -1), room0Ref),
	];
}

export function connectRooms( gdm:GameDataManager, room0Ref:string, room1Ref:string, offset:Vector3D ):void {
	offset = deepFreeze(offset);
	const room0 = gdm.getMutableRoom(room0Ref);
	if( room0 == null ) throw new Error("Failed to get room "+room0Ref);
	const room1 = gdm.getMutableRoom(room1Ref);
	if( room1 == null ) throw new Error("Failed to get room "+room1Ref);
	const [neighborKey0To1,neighborKey1To0] = roomNeighborKeys(room0Ref, offset, room1Ref);
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
