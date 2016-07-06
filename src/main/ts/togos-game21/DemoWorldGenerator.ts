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
import { AnimationType } from './Animation';
import { Game, PhysicalObject, PhysicalObjectType, TileTree, Room } from './world';
import { sha1Urn, base32Encode, hash } from '../tshash/index';
import SHA1 from '../tshash/SHA1';
import { uuidUrn, newType4Uuid } from '../tshash/uuids';
import { deepFreeze, thaw, clone } from './DeepFreezer';
import { makeTileTreeRef, connectRooms } from './worldutil';

export function simpleObjectVisualShape( drawFunction:(ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D )=>void ):MAObjectVisual {
	const shape:ProceduralShape = {
		animationType: AnimationType.NONE,
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
					type: AnimationType.NONE,
					length: Infinity,
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
		
		const blockMaVisual:MAObjectVisual = simpleObjectVisualShape( (ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D) => {
			const center = xf.multiplyVector(Vector3D.ZERO);
			const size = xf.scale;
			ssu.plottedDepthFunction = (x:number, y:number, z:number) => z;
			ssu.plottedMaterialIndexFunction = (x:number, y:number, z:number) => 4;
			ssu.plotAASharpBeveledCuboid( center.x-size/2, center.y-size/2, center.z-size/2, size, size, size/6);
		});
		const bigBlockSize = 8;
		const bigBlockMaVisual:MAObjectVisual = simpleObjectVisualShape( (ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D) => {
			const center = xf.multiplyVector(Vector3D.ZERO);
			const size = xf.scale*bigBlockSize;
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
			visualBoundingBox: blockCuboid,
			opacity: 1,
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
			visualBoundingBox: blockCuboid,
			opacity: 1,
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
		
		const tileTree1cRef = makeTileTreeRef( [
			null,
			brickPrototypeId,
			blockPrototypeId,
		], 4, 4, 1, [
			2,2,2,2,
			2,1,2,2,
			2,2,1,2,
			2,2,2,2,
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
		
		const tileTree2cRef = makeTileTreeRef( [
			null,
			tileTree1cRef,
		], 4, 4, 1, [
			1,1,1,1,
			1,0,0,0,
			1,0,0,0,
			1,0,0,0,
		], game);
		
		const tileTree2dRef = makeTileTreeRef( [
			null,
			tileTree1cRef,
		], 4, 4, 1, [
			1,1,1,1,
			0,0,0,1,
			0,0,0,1,
			0,0,0,1,
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
			tileTree2cRef,
			tileTree2dRef
		], 8, 8, 1, [
			1,1,1,1,1,1,1,1,
			1,1,1,1,1,1,1,1,
			1,1,1,1,1,1,1,1,
			1,1,1,2,3,1,1,1,
			1,1,0,0,0,0,1,1,
			0,0,0,0,0,0,0,0,
			1,1,1,0,0,1,1,1,
			1,1,1,1,1,1,1,1,
		], game);
		
		const bigBlockBb = new Cuboid(-4, -4, -4, 4, 4, 4);
		const bigBlockPrototypeRef = newUuidRef();
		game.objectPrototypes[bigBlockPrototypeRef] = {
			position: new Vector3D((Math.random()-0.5)*128, (Math.random()-0.5)*64, 10+16*Math.random()-0.5),
			orientation: Quaternion.IDENTITY,
			type: PhysicalObjectType.INDIVIDUAL,
			isInteractive: true,
			isRigid: true,
			bounciness: 0.5,
			isAffectedByGravity: false,
			mass: 8,
			stateFlags: 0,
			visualRef: bigBlockVisualRef,
			tilingBoundingBox: bigBlockBb,
			physicalBoundingBox: bigBlockBb,
			visualBoundingBox: bigBlockBb
		};
		
		const backgroundTree0Ref = makeTileTreeRef( [
			null,
			bigBlockPrototypeRef
		], 4,4,4, [
			0, 1, 0, 1,
			0, 1, 0, 1,
			0, 1, 0, 1,
			0, 1, 0, 1,

			0, 1, 0, 0,
			1, 1, 1, 1,
			0, 1, 0, 0,
			0, 1, 0, 0,

			0, 0, 0, 0,
			1, 1, 1, 1,
			0, 0, 0, 0,
			0, 0, 0, 0,

			0, 0, 0, 1,
			1, 1, 0, 1,
			0, 1, 0, 0,
			0, 1, 1, 1,			
		], game);
		const backgroundTree1Ref = makeTileTreeRef( [
			null,
			backgroundTree0Ref
		], 4,4,1, [
			1, 0, 0, 0,
			1, 1, 1, 1,
			0, 0, 1, 0,
			1, 1, 1, 1,
		], game);
		//roomObjects[newUuidRef()] = game.objectPrototypes[tileTree3Ref]; 
		
		const crappyRoom0Id = newUuidRef();
		const crappyRoom1Id = newUuidRef();
		
		const backgroundTree = clone(game.objectPrototypes[backgroundTree1Ref]);
		backgroundTree.position = new Vector3D(0,0,20);
		
		game.rooms[crappyRoom0Id] = {
			objects: {
				[newUuidRef()]: game.objectPrototypes[tileTree3Ref],
				[newUuidRef()]: backgroundTree,
			},
			bounds: game.objectPrototypes[tileTree3Ref].tilingBoundingBox,
			neighbors: {}
		};
		game.rooms[crappyRoom1Id] = {
			objects: {
				[newUuidRef()]: game.objectPrototypes[tileTree4Ref],
				[newUuidRef()]: backgroundTree,
			},
			bounds: game.objectPrototypes[tileTree4Ref].tilingBoundingBox,
			neighbors: {}
		};
		
		connectRooms( game, crappyRoom0Id, crappyRoom1Id, new Vector3D(-128, -64, 0));
		connectRooms( game, crappyRoom0Id, crappyRoom1Id, new Vector3D( 128, -64, 0));
		
		return game;
	}
}

