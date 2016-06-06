import ObjectVisual, {MAObjectVisual} from './ObjectVisual';
import Cuboid from './Cuboid';
import Quaternion from './Quaternion';
import KeyedList from './KeyedList';
import Vector3D from './Vector3D';
import SurfaceMaterial from './Material';

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

export enum PhysicalObjectType {
	TILE_TREE,
	INDIVIDUAL
}

export interface PhysicalObject {
	debugLabel? : string;
	position? : Vector3D; // Ignored (and should be null) for tiles/prototypes
	velocity? : Vector3D;
	orientation? : Quaternion;
	
	prototypeRef?:string; // If indicated, the following properties are defined by the template
	// In theory an object's properties just default to those of its prototype.
	// Position, velocity, and orientation are relative.
	// In practice I may make assumptions that only the object or its prototype
	// may specify any given property and it's ~undefined behavior condition~
	// for certain properties or sets of properties to be specified on both.
	
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
	stateFlags:number;
	
	visualRef? : string;
}

export interface TileTree extends PhysicalObject {
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
	materialPalettes: KeyedList<Array<string>>;
	maObjectVisuals: KeyedList<MAObjectVisual>;
	objectVisuals: KeyedList<ObjectVisual>;
	tilePalettes: KeyedList<Array<string>>;
	objectPrototypes: KeyedList<PhysicalObject>;
	rooms: KeyedList<Room>;
	time: number; // Current time in the world
}

export const HUNIT_CUBE:Cuboid = deepFreeze(new Cuboid(-0.5,-0.5,-0.5, +0.5,+0.5,+0.5));
