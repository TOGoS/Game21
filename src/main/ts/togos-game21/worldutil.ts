import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import Cuboid from './Cuboid';
import { Game, RoomEntity, Entity, EntityClass, StructureType, TileTree, TileEntityPalette } from './world';
import { deepFreeze } from './DeepFreezer';
import { hash, sha1Urn, base32Encode } from '../tshash/index';
import SHA1 from '../tshash/SHA1';
import { coalesce2 } from './util';

const posBuffer0:Vector3D=new Vector3D;

function toArray<T,D extends ArrayLike<T>>(src:ArrayLike<T>, dest:D):D {
	for( let i=0; i < src.length; ++i ) (<any>dest)[i] = src[i];
	return dest;
}
function toUint8Array(src:ArrayLike<number>):Uint8Array {
	return toArray(src, new Uint8Array(src.length));
}

function saveObject( obj:any ):string {
	const json:string = JSON.stringify(obj, null, "\t") + "\t";
	return sha1Urn(json)+"#";
}

function entityClassRef( op?:any, game?:Game ):string|null {
	if( op == null ) return null;
	if( typeof op == 'string' ) return op;
	
	if( game == null ) throw new Error("Can't generate object prototype ref without game object"); // Well, really we should be able to for hash URN things eventually
	
	const ref:string = saveObject(op);
	game.entityClasses[ref] = op;
	return ref;
}

function paletteRef( palette:any, game:Game ):string {
	if( typeof palette == 'string' ) return palette;
	
	if( game == null ) throw new Error("Can't generate palette ref without game object"); // Well, really we should be able to for hash URN things eventually
	
	if( !Array.isArray(palette) ) throw new Error("Supposed tile palette is not an array; can't reference it: "+JSON.stringify(palette));
	
	const tilePalette:TileEntityPalette = palette.map( (obj:any) => deepFreeze({
		orientation: Quaternion.IDENTITY, // For now
		entity: {
			classRef: entityClassRef(obj, game)
		},
	}) );
	
	const ref:string = saveObject(palette);
	game.tilePalettes[ref] = tilePalette;
	return ref;
}

// 'game' is used to look up tile palettes/object prototypes by UUID.
// Could be replaced with some accessor thingy, possibly asynchronous.
export function eachSubEntity(
	entity:Entity, pos:Vector3D, game:Game,
	callback:(subEnt:Entity, pos:Vector3D, orientation:Quaternion)=>void,
	callbackThis:any=null, posBuffer:Vector3D=posBuffer0
) {
	const proto = game.entityClasses[entity.classRef];
	if( proto == null ) return;
	
	if( proto.structureType == StructureType.NONE ) {
	} else if( proto.structureType == StructureType.INDIVIDUAL ) {
		// No sub-objects!
	} else if( proto.structureType == StructureType.TILE_TREE ) {
		const tt:TileTree = <TileTree>proto;
		const tilePaletteIndexes = tt.childEntityIndexes;
		const tilePalette = game.tilePalettes[tt.childEntityPaletteRef];
		const entityClasses = game.entityClasses;
		const xd = tt.tilingBoundingBox.width/tt.xDivisions;
		const yd = tt.tilingBoundingBox.height/tt.yDivisions;
		const zd = tt.tilingBoundingBox.depth/tt.zDivisions;
		const x0 = pos.x - tt.tilingBoundingBox.width/2  + xd/2;
		const y0 = pos.y - tt.tilingBoundingBox.height/2 + yd/2;
		const z0 = pos.z - tt.tilingBoundingBox.depth/2  + zd/2;
		for( let i=0, z=0; z < tt.zDivisions; ++z ) for( let y=0; y < tt.yDivisions; ++y ) for( let x=0; x < tt.xDivisions; ++x, ++i ) {
			const tileEntity = tilePalette[tilePaletteIndexes[i]];
			if( tileEntity != null ) {
				callback.call( callbackThis, tileEntity.entity, posBuffer.set(x0+x*xd, y0+y*yd, z0+z*zd), tileEntity.orientation );
			}
		}
	} else {
		throw new Error("Unrecognized physical object type: "+proto.structureType);
	}
}

export function makeTileTreeNode( palette:any, w:number, h:number, d:number, _indexes:any, game:Game ):TileTree {
	if( _indexes.length != w*h*d ) {
		throw new Error("Expected 'indexes' to be array of length "+(w*d*h)+"; but it had length "+_indexes.length);
	}
	const indexes:Uint8Array = toUint8Array(_indexes);
	const _paletteRef = paletteRef(palette, game);
	
	const tilePalette = game.tilePalettes[_paletteRef]
	let tileW = 0, tileH = 0, tileD = 0;
	for( let t in tilePalette ) {
		const tileEntity = tilePalette[t];
		if( tileEntity == null ) continue;
		const tileClassRef = tileEntity.entity.classRef;
		const tileClass = game.entityClasses[tileClassRef];
		if( tileClass == null ) throw new Error("Couldn't find entity class "+tileClassRef+" while calculating size for tile tree; given palette: "+JSON.stringify(palette)+"; "+JSON.stringify(tilePalette));
		tileW = Math.max(tileClass.tilingBoundingBox.width , tileW);
		tileH = Math.max(tileClass.tilingBoundingBox.height, tileH);
		tileD = Math.max(tileClass.tilingBoundingBox.depth , tileD);
	}

	let totalOpacity:number = 0;
	for( let i = w*d*h-1; i >= 0; --i ) {
		const tileEntity = tilePalette[indexes[i]];
		if( tileEntity == null ) continue;
		if( tileEntity.entity.classRef == null ) continue;
		const tileClass = game.entityClasses[tileEntity.entity.classRef];
		totalOpacity += tileClass.opacity ? tileClass.opacity : 0;
	}
	
	const tilingBoundingBox = new Cuboid(-tileW*w/2, -tileH*h/2, -tileD*d/2, +tileW*w/2, +tileH*h/2, +tileD*d/2);
	
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
		// These don't really make sense to have to have on a tile tree
		isAffectedByGravity: false,
		visualRef: undefined,
		opacity: totalOpacity/(w*h*d),
	}
}

export function makeTileTreeRef( palette:any, w:number, h:number, d:number, indexes:any, game:Game ):string {
	const tt:TileTree = makeTileTreeNode(palette, w, h, d, indexes, game);
	const ref:string = saveObject(tt);
	game.entityClasses[ref] = tt;
	return ref;
}

export function connectRooms( game:Game, room0Ref:string, room1Ref:string, offset:Vector3D ):string {
	offset = deepFreeze(offset);
	const room0 = game.rooms[room0Ref];
	const room1 = game.rooms[room1Ref];
	const neighborKey = "n"+base32Encode(hash(room0Ref+";"+room1Ref+";"+offset.toArray().join(","), SHA1));
	room0.neighbors[neighborKey] = {
		offset: offset,
		roomRef: room1Ref,
		bounds: room1.bounds,
	}
	room1.neighbors[neighborKey] = {
		offset: offset.scale(-1),
		roomRef: room0Ref,
		bounds: room0.bounds,
	}
	return neighborKey;
}

export function roomEntityVelocity(re:RoomEntity):Vector3D {
	return coalesce2(re.velocity, Vector3D.ZERO);
}
export function roomEntityOrientation(re:RoomEntity):Quaternion {
	return coalesce2(re.orientation, Quaternion.IDENTITY);
}
