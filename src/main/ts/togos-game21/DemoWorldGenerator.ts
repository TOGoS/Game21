import ShapeSheetUtil from './ShapeSheetUtil';
import TransformationMatrix3D from './TransformationMatrix3D';
import ProceduralShape from './ProceduralShape';
import Rectangle from './Rectangle';
import Cuboid from './Cuboid';
import Quaternion from './Quaternion';
import Vector3D from './Vector3D';
import KeyedList from './KeyedList';
import {
	DEFAULT_MATERIAL_MAP, IDENTITY_MATERIAL_REMAP, DEFAULT_MATERIALS, DEFAULT_MATERIAL_PALETTE, DEFAULT_MATERIAL_PALETTE_REF,
	makeRemap, remap
} from './materials';
import ObjectVisual, { MAObjectVisual, VisualBasisType } from './ObjectVisual';
import { OnAnimationEnd } from './Animation';
import { Game, PhysicalObject, PhysicalObjectType, TileTree, Room } from './world';
import { sha1Urn, base32Encode, hash } from '../tshash/index';
import SHA1 from '../tshash/SHA1';
import { uuidUrn, newType4Uuid } from '../tshash/uuids';
import { deepFreeze, thaw } from './DeepFreezer';

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
		visualRef: null
	}
}

export function makeTileTreeRef( palette:any, w:number, h:number, d:number, indexes:any, game:Game ):string {
	const tt:TileTree = makeTileTreeNode(palette, w, h, d, indexes, game);
	const ref:string = saveObject(tt);
	game.objectPrototypes[ref] = tt;
	return ref;
}

export function simpleObjectVisualShape( drawFunction:(ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D )=>void ):MAObjectVisual {
	const shape:ProceduralShape = {
		isAnimated: false,
		estimateOuterBounds: (t:number, xf:TransformationMatrix3D) => {
			let s = xf.scale;
			return new Rectangle(-s*16, -s*16, s*16, s*16)
		},
		draw: drawFunction
	}
	
	// TODO: Also use drawn bounds to generate object bounding box, etc
	return {
		states: [
			{
				orientation: Quaternion.IDENTITY,
				applicabilityFlagsMax: 0xFFFFFFFF,
				applicabilityFlagsMin: 0x00000000,
				materialRemap: IDENTITY_MATERIAL_REMAP,
				animation: {
					length: Infinity,
					onEnd: OnAnimationEnd.LOOP,
					frames: [
						{
							visualBasisType: VisualBasisType.PROCEDURAL,
							materialRemap: IDENTITY_MATERIAL_REMAP,
							shape: shape
						}
					],
				}
			}
		]
	}
}

export function newUuidRef() { return uuidUrn(newType4Uuid()); }

export const crappyBlockVisualRef = "urn:uuid:00cd941d-0083-4084-ab7f-0f2de1911c3f";
export const bigBlockVisualRef = newUuidRef();
export const crappyBrickVisualRef = "urn:uuid:b8a7c634-8caa-47a1-b8dd-0587dd303b13";

function connectRooms( game:Game, room0Ref:string, room1Ref:string, offset:Vector3D ):string {
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

export default class DemoWorldGenerator {
	public makeCrappyGame():Game {
		const game:Game = {
			materials: thaw(DEFAULT_MATERIALS),
			materialPalettes: { [DEFAULT_MATERIAL_PALETTE_REF]: DEFAULT_MATERIAL_PALETTE },
			maObjectVisuals: {},
			objectVisuals: {},
			rooms: {},
			tilePalettes: {},
			objectPrototypes: {},
			time: 0,
		}
		
		const theMaterialMap = DEFAULT_MATERIAL_MAP;
		const roomObjects:KeyedList<PhysicalObject> = {};
		const randomBlockCount = 10;
		for( let i=0; i<randomBlockCount; ++i ) {
			const objectId = newUuidRef();
			roomObjects[objectId] = {
				position: new Vector3D((Math.random()-0.5)*10, (Math.random()-0.5)*10, 0), //(Math.random()-0.5)*10),
				orientation: Quaternion.IDENTITY,
				type: PhysicalObjectType.INDIVIDUAL,
				isInteractive: true,
				isRigid: true,
				bounciness: 0.5,
				isAffectedByGravity: true,
				mass: 8,
				stateFlags: 0,
				visualRef: bigBlockVisualRef,
				tilingBoundingBox: new Cuboid(-1, -1, -1, 1, 1, 1),
				physicalBoundingBox: new Cuboid(-1, -1, -1, 1, 1, 1),
				visualBoundingBox: new Cuboid(-1, -1, -1, 1, 1, 1)
			};
		}
		
		const blockMaVisual:MAObjectVisual = simpleObjectVisualShape( (ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D) => {
			const center = xf.multiplyVector(Vector3D.ZERO);
			const size = xf.scale;
			ssu.plottedDepthFunction = (x:number, y:number, z:number) => z;
			ssu.plottedMaterialIndexFunction = (x:number, y:number, z:number) => 4;
			ssu.plotAASharpBeveledCuboid( center.x-size/2, center.y-size/2, center.z-size/2, size, size, size/6);
		});
		const bigBlockMaVisual:MAObjectVisual = simpleObjectVisualShape( (ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D) => {
			const center = xf.multiplyVector(Vector3D.ZERO);
			const size = xf.scale*2;
			ssu.plottedDepthFunction = (x:number, y:number, z:number) => z;
			ssu.plottedMaterialIndexFunction = (x:number, y:number, z:number) => 4;
			ssu.plotAABeveledCuboid( center.x-size/2, center.y-size/2, center.z-size/2, size, size, size/6);
		});
		const blockMaterialMap = DEFAULT_MATERIAL_MAP; 
		const blockVisual:ObjectVisual = {
			materialMap: DEFAULT_MATERIAL_MAP,
			maVisual: blockMaVisual
		}
		const brickRemap = makeRemap(4,8,4);
		const brickVisual:ObjectVisual = {
			materialMap: remap(DEFAULT_MATERIAL_MAP, brickRemap),
			maVisual: blockMaVisual
		}
		const bigBlockVisual:ObjectVisual = {
			materialMap: DEFAULT_MATERIAL_MAP,
			maVisual: bigBlockMaVisual
		}
		
		game.objectVisuals[crappyBlockVisualRef] = blockVisual;
		game.objectVisuals[crappyBrickVisualRef] = brickVisual;
		game.objectVisuals[bigBlockVisualRef] = bigBlockVisual;
		
		const blockCuboid = new Cuboid(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5);
		
		const brickPrototypeId = newUuidRef();
		game.objectPrototypes[brickPrototypeId] = {
			position: null,
			orientation: Quaternion.IDENTITY,
			type: PhysicalObjectType.INDIVIDUAL,
			isInteractive: true,
			isRigid: true,
			bounciness: 0.5,
			isAffectedByGravity: false,
			stateFlags: 0,
			visualRef: crappyBrickVisualRef,
			tilingBoundingBox: blockCuboid,
			physicalBoundingBox: blockCuboid,
			visualBoundingBox: blockCuboid
		}
		
		const blockPrototypeId = newUuidRef();
		game.objectPrototypes[blockPrototypeId] = {
			position: null,
			orientation: Quaternion.IDENTITY,
			type: PhysicalObjectType.INDIVIDUAL,
			isInteractive: true,
			isRigid: true,
			bounciness: 0.5,
			isAffectedByGravity: false,
			stateFlags: 0,
			visualRef: crappyBlockVisualRef,
			tilingBoundingBox: blockCuboid,
			physicalBoundingBox: blockCuboid,
			visualBoundingBox: blockCuboid
		}
		
		const tileTreeLeafPaletteRef = newUuidRef();
		game.tilePalettes[tileTreeLeafPaletteRef] = [
			null,
			brickPrototypeId
		];
		
		const tileTree0Ref = makeTileTreeRef( [
			null,
			brickPrototypeId,
			blockPrototypeId,
		], 4, 4, 1, [
			1,1,1,1,
			1,0,0,1,
			1,0,0,1,
			1,1,1,1,
		], game);
		
		const tileTree1Ref = makeTileTreeRef( [
			null,
			brickPrototypeId,
			blockPrototypeId,
		], 4, 4, 1, [
			0,0,0,0,
			0,0,0,0,
			2,2,2,2,
			1,1,1,1,
		], game);
		
		const tileTree1bRef = makeTileTreeRef( [
			null,
			brickPrototypeId,
			blockPrototypeId,
		], 4, 4, 1, [
			1,2,1,2,
			2,1,2,1,
			1,2,1,2,
			2,1,2,1,
		], game);

		const tileTree2Ref = makeTileTreeRef( [
			null,
			tileTree0Ref,
			tileTree1Ref,
		], 4, 4, 1, [
			1,1,1,1,
			1,0,0,1,
			1,2,2,1,
			1,1,1,1,
		], game);
		
		const tileTree2bRef = makeTileTreeRef( [
			null,
			tileTree0Ref,
			tileTree1bRef,
		], 4, 4, 1, [
			1,1,1,1,
			1,2,2,1,
			1,2,2,1,
			1,1,1,1,
		], game);
		
		const tileTree3Ref = makeTileTreeRef( [
			null,
			tileTree2Ref,
		], 8, 8, 1, [
			1,1,1,1,1,1,1,1,
			0,0,0,0,0,0,0,0,
			1,0,0,1,1,1,0,1,
			1,0,1,0,0,1,0,1,
			1,0,1,0,0,1,0,1,
			1,0,0,0,0,1,0,1,
			1,1,0,1,0,0,0,1,
			1,1,1,1,1,1,1,1,
		], game);
		
		const tileTree4Ref = makeTileTreeRef( [
			null,
			tileTree2bRef,
		], 8, 8, 1, [
			1,1,1,1,1,1,1,1,
			1,1,1,1,1,1,1,1,
			1,1,1,1,1,1,1,1,
			1,1,1,1,1,1,1,1,
			1,1,0,0,0,0,1,1,
			0,0,0,0,0,0,0,0,
			1,1,1,0,0,1,1,1,
			1,1,1,1,1,1,1,1,
		], game);

		roomObjects[newUuidRef()] = game.objectPrototypes[tileTree3Ref]; 
		
		const crappyRoom0Id = newUuidRef();
		const crappyRoom1Id = newUuidRef();
		
		game.rooms[crappyRoom0Id] = {
			objects: { [newUuidRef()]: game.objectPrototypes[tileTree3Ref] },
			bounds: game.objectPrototypes[tileTree3Ref].tilingBoundingBox,
			neighbors: {}
		};
		game.rooms[crappyRoom1Id] = {
			objects: { [newUuidRef()]: game.objectPrototypes[tileTree4Ref] },
			bounds: game.objectPrototypes[tileTree4Ref].tilingBoundingBox,
			neighbors: {}
		};
		connectRooms( game, crappyRoom0Id, crappyRoom1Id, new Vector3D(-128, -64, 0));
		connectRooms( game, crappyRoom0Id, crappyRoom1Id, new Vector3D( 128, -64, 0));
		
		return game;
	}
}

