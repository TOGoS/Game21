import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import Cuboid from './Cuboid';
import { Game, PhysicalObject, PhysicalObjectType, TileTree } from './world';
import { deepFreeze } from './DeepFreezer';
import { hash, sha1Urn, base32Encode } from '../tshash/index';
import SHA1 from '../tshash/SHA1';

const posBuffer0:Vector3D=new Vector3D;

function toArray<T,D extends ArrayLike<T>>(src:ArrayLike<T>, dest:D):D {
	for( let i=0; i<src.length; ++i ) dest[i] = src[i];
	return dest;
}
function toUint8Array(src:ArrayLike<number>):Uint8Array {
	return toArray(src, new Uint8Array(src.length));
}

function saveObject( obj:any ):string {
	const json:string = JSON.stringify(obj, null, "\t") + "\t";
	return sha1Urn(json)+"#";
}

function objectPrototypeRef( op:any, game?:Game ):string {
	if( op == null ) return null;
	if( typeof op == 'string' ) return op;
	
	if( game == null ) throw new Error("Can't generate object prototype ref without game object"); // Well, really we should be able to for hash URN things eventually
	
	const ref:string = saveObject(op);
	game.objectPrototypes[ref] = op;
	return ref;
}

function paletteRef( palette:any, game:Game ):string {
	if( typeof palette == 'string' ) return palette;
	
	if( game == null ) throw new Error("Can't generate palette ref without game object"); // Well, really we should be able to for hash URN things eventually
	
	if( !Array.isArray(palette) ) throw new Error("Supposed tile palette is not an array; can't reference it: "+JSON.stringify(palette));
	
	palette = palette.map( (obj:any) => objectPrototypeRef(obj, game) );
	
	const ref:string = saveObject(palette);
	game.tilePalettes[ref] = palette;
	return ref;
}

// 'game' is used to look up tile palettes/object prototypes by UUID.
// Could be replaced with some accessor thingy, possibly asynchronous.
export function eachSubObject( obj:PhysicalObject, pos:Vector3D, game:Game, callback:(subObj:PhysicalObject, pos:Vector3D)=>void, callbackThis:any=null, posBuffer:Vector3D=posBuffer0 ) {
	if( obj.type == PhysicalObjectType.INDIVIDUAL ) {
		// No sub-objects!
	} else if( obj.type == PhysicalObjectType.TILE_TREE ) {
		const tt:TileTree = <TileTree>obj;
		const tilePaletteIndexes = tt.childObjectIndexes;
		const tilePalette = game.tilePalettes[tt.childObjectPaletteRef];
		const objectPrototypes = game.objectPrototypes;
		const xd = tt.tilingBoundingBox.width/tt.xDivisions;
		const yd = tt.tilingBoundingBox.height/tt.yDivisions;
		const zd = tt.tilingBoundingBox.depth/tt.zDivisions;
		const x0 = pos.x - tt.tilingBoundingBox.width/2  + xd/2;
		const y0 = pos.y - tt.tilingBoundingBox.height/2 + yd/2;
		const z0 = pos.z - tt.tilingBoundingBox.depth/2  + zd/2;
		for( let i=0, z=0; z < tt.zDivisions; ++z ) for( let y=0; y < tt.yDivisions; ++y ) for( let x=0; x < tt.xDivisions; ++x, ++i ) {
			const childId = tilePalette[tilePaletteIndexes[i]];
			if( childId != null ) {
				const child = objectPrototypes[childId];
				callback.call( callbackThis, child, posBuffer.set(x0+x*xd, y0+y*yd, z0+z*zd) );
			}
		}
	} else {
		throw new Error("Unrecognized physical object type: "+obj.type);
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
		const tileRef = tilePalette[t];
		if( tileRef == null ) continue;
		const tile = game.objectPrototypes[tileRef];
		if( tile == null ) throw new Error("Couldn't find tile "+tileRef+" while calculating size for tile tree; given palette: "+JSON.stringify(palette)+"; "+JSON.stringify(tilePalette));
		tileW = Math.max(tile.tilingBoundingBox.width , tileW);
		tileH = Math.max(tile.tilingBoundingBox.height, tileH);
		tileD = Math.max(tile.tilingBoundingBox.depth , tileD);
	}

	let totalOpacity:number = 0;
	for( let i = w*d*h-1; i >= 0; --i ) {
		const tileRef = tilePalette[indexes[i]];
		if( tileRef == null ) continue;
		const tile = game.objectPrototypes[tileRef];
		totalOpacity += tile.opacity ? tile.opacity : 0;
	}
	
	const tilingBoundingBox = new Cuboid(-tileW*w/2, -tileH*h/2, -tileD*d/2, +tileW*w/2, +tileH*h/2, +tileD*d/2);
	
	return {
		position: Vector3D.ZERO,
		orientation: Quaternion.IDENTITY,
		visualBoundingBox: tilingBoundingBox, // TODO: potentially different!
		physicalBoundingBox: tilingBoundingBox, // TODO: potentially different!
		type: PhysicalObjectType.TILE_TREE,
		tilingBoundingBox: tilingBoundingBox,
		xDivisions: w,
		yDivisions: h,
		zDivisions: d,
		childObjectPaletteRef: _paletteRef,
		childObjectIndexes: indexes,
		// These don't really make sense to have to have on a tile tree
		isAffectedByGravity: false,
		stateFlags: 0,
		visualRef: null,
		opacity: totalOpacity/(w*h*d),
	}
}

export function makeTileTreeRef( palette:any, w:number, h:number, d:number, indexes:any, game:Game ):string {
	const tt:TileTree = makeTileTreeNode(palette, w, h, d, indexes, game);
	const ref:string = saveObject(tt);
	game.objectPrototypes[ref] = tt;
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