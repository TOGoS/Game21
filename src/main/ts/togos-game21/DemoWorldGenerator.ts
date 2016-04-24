import ShapeSheetUtil from './ShapeSheetUtil';
import TransformationMatrix3D from './TransformationMatrix3D';
import ProceduralShape from './ProceduralShape';
import Rectangle from './Rectangle';
import Cuboid from './Cuboid';
import Quaternion from './Quaternion';
import Vector3D from './Vector3D';
import KeyedList from './KeyedList';
import { DEFAULT_MATERIALS, IDENTITY_MATERIAL_REMAP, makeRemap,remap } from './materials';
import ObjectVisual, { MAObjectVisual, VisualBasisType } from './ObjectVisual';
import { OnAnimationEnd } from './Animation';
import { Game, PhysicalObject, PhysicalObjectType, TileTree, Room } from './world';
// import { toUint8Array } from '../tshash/utils';
import { uuidUrn, newType4Uuid } from '../tshash/uuids';

function toArray<T,D extends ArrayLike<T>>(src:ArrayLike<T>, dest:D):D {
	for( let i=0; i<src.length; ++i ) dest[i] = src[i];
	return dest;
}
function toUint8Array(src:ArrayLike<number>):Uint8Array {
	return toArray(src, new Uint8Array(src.length));
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

function newUuid() { return uuidUrn(newType4Uuid()); }

export const crappyBlockVisualId = "urn:uuid:00cd941d-0083-4084-ab7f-0f2de1911c3f";
export const crappyBrickVisualId = "urn:uuid:b8a7c634-8caa-47a1-b8dd-0587dd303b13";

export default class DemoWorldGenerator {
	public makeCrappyGame():Game {
		const crappyRoomId = newUuid();
		const theMaterialMap = DEFAULT_MATERIALS;
		const roomObjects:KeyedList<PhysicalObject> = {};
		for( let i=0; i<100; ++i ) {
			const objectId = newUuid();
			roomObjects[objectId] = {
				position: new Vector3D((Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10),
				orientation: Quaternion.IDENTITY,
				type: PhysicalObjectType.INDIVIDUAL,
				isRigid: true,
				isAffectedByGravity: false,
				stateFlags: 0,
				visualRef: crappyBlockVisualId,
				physicalBoundingBox: new Cuboid(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5),
				visualBoundingBox: new Cuboid(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5)
			};
		}
		
		const blockMaVisual:MAObjectVisual = simpleObjectVisualShape( (ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D) => {
			const center = xf.multiplyVector(Vector3D.ZERO);
			const size = xf.scale;
			ssu.plottedDepthFunction = (x:number, y:number, z:number) => z;
			ssu.plottedMaterialIndexFunction = (x:number, y:number, z:number) => 8;
			ssu.plotAASharpBeveledCuboid( center.x-size/2, center.y-size/2, center.z-size/2, size, size, size/6);
		});
		const blockMaterialMap = DEFAULT_MATERIALS; 
		const blockVisual:ObjectVisual = {
			materialMap: DEFAULT_MATERIALS,
			maVisual: blockMaVisual
		}
		const brickRemap = makeRemap(8,4,4);
		const brickVisual:ObjectVisual = {
			materialMap: remap(DEFAULT_MATERIALS, brickRemap),
			maVisual: blockMaVisual
		}
		
		const brickPrototypeId = newUuid();
		const brick:PhysicalObject = {
			position: null,
			orientation: Quaternion.IDENTITY,
			type: PhysicalObjectType.INDIVIDUAL,
			isRigid: true,
			isAffectedByGravity: false,
			stateFlags: 0,
			visualRef: crappyBrickVisualId,
			physicalBoundingBox: new Cuboid(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5),
			visualBoundingBox: new Cuboid(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5)
		}
		
		const tilePaletteRef = newUuid();
		const tilePalette = [
			null,
			brickPrototypeId
		];
		
		const tileTree:TileTree = {
			position: new Vector3D(0,0,0),
			orientation: Quaternion.IDENTITY,
			visualBoundingBox: new Cuboid(-2,-2,-0.5,+2,+2,+0.5),
			physicalBoundingBox: new Cuboid(-2,-2,-0.5,+2,+2,+0.5),
			type: PhysicalObjectType.TILE_TREE,
			divisionBox: new Cuboid(-2,-2,-0.5,+2,+2,+0.5),
			xDivisions: 4,
			yDivisions: 4,
			zDivisions: 1,
			childObjectPaletteRef: tilePaletteRef,
			childObjectIndexes: toUint8Array([
				1,1,1,1,
				1,0,0,1,
				1,0,0,1,
				1,1,1,1,
			]),
			// These don't really make sense to have to have on a tile tree
			isAffectedByGravity: false,
			isRigid: false,
			stateFlags: 0,
			visualRef: null
		}
		
		const tileTreeUuid = newUuid();
		roomObjects[tileTreeUuid] = tileTree;
		
		return {
			objectVisuals: {
				[crappyBlockVisualId]: blockVisual,
				[crappyBrickVisualId]: brickVisual,
			},
			rooms: {
				[crappyRoomId]: {
					objects: roomObjects,
					neighbors: {}
				}
			},
			tilePalettes: {
				[tilePaletteRef]: tilePalette
			},
			objectPrototypes: {
				[brickPrototypeId]: brick
			}
		};
	}
}

