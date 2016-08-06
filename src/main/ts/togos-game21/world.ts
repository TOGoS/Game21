import ObjectVisual, {MAObjectVisual} from './ObjectVisual';
import Cuboid from './Cuboid';
import Quaternion from './Quaternion';
import KeyedList from './KeyedList';
import Vector3D from './Vector3D';
import SurfaceMaterial from './SurfaceMaterial';

import { deepFreeze } from './DeepFreezer';

export interface RoomNeighbor {
	offset:Vector3D;
	/**
	 * The room's bounding box, relative to its offset.
	 * This is duplicated from the room's own data.
	 */
	bounds:Cuboid;
	roomRef:string;
}

// TODO: Separate into:
// - RoomGameObject (object + position)
// - GameObject (object class reference + state)
// - GameObjectClass (currently 'ProtoObject')

export enum PhysicalObjectType {
	TILE_TREE,
	INDIVIDUAL
}

/**
 * These should be considered immutable.
 */
export interface ProtoObject {
	type:PhysicalObjectType;
	
	// Bounding boxes are relative to the object's position (whether indicated externally or internally)
	tilingBoundingBox:Cuboid; // Used by tile trees to determine division, etc
	physicalBoundingBox:Cuboid;
	visualBoundingBox:Cuboid;
	
	isAffectedByGravity:boolean;
	isInteractive?:boolean; // Does it need to be taken into account by collision detection?
	isRigid?:boolean;
	opacity?:number; // For space-filling trees, this should be something like the average of contained items' opacities
	bounciness?:number;
	mass?:number;
	
	visualRef? : string;
}

export interface PhysicalObject {
	debugLabel? : string;
	position : Vector3D; // Ignored (and should be null) for tiles/prototypes
	
	// Assumed 0,0,0 if undefined
	velocity? : Vector3D;
	// Assumed identify if undefined
	orientation? : Quaternion;
	
	prototypeRef : string;
	stateFlags : number;
}

export interface TileTree extends ProtoObject {
	xDivisions:number;
	yDivisions:number;
	zDivisions:number;
	childObjectPaletteRef:string;
	childObjectIndexes:Uint8Array;
}

export interface Room {
	bounds:Cuboid;
	objects:KeyedList<PhysicalObject>;
	neighbors:KeyedList<RoomNeighbor>;
}

export interface Game {
	materials: KeyedList<SurfaceMaterial>;
	materialPalettes: KeyedList<Array<string|undefined>>;
	maObjectVisuals: KeyedList<MAObjectVisual>;
	objectVisuals: KeyedList<ObjectVisual>;
	tilePalettes: KeyedList<Array<string|undefined>>;
	protoObjects: KeyedList<ProtoObject>;
	rooms: KeyedList<Room>;
	time: number; // Current time in the world
}

export const HUNIT_CUBE:Cuboid = deepFreeze(new Cuboid(-0.5,-0.5,-0.5, +0.5,+0.5,+0.5));
