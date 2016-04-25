import ObjectVisual from './ObjectVisual';
import Cuboid from './Cuboid';
import Quaternion from './Quaternion';
import KeyedList from './KeyedList';
import Vector3D from './Vector3D';

export interface RoomNeighbor {
	offset:Vector3D;
	/**
	 * The room's bounding box, relative to its offset.
	 * This is duplicated from the room's own data.
	 */
	bounds:Cuboid;
	roomId:string;
}

export enum PhysicalObjectType {
	TILE_TREE,
	INDIVIDUAL
}

export interface PhysicalObject {
	position? : Vector3D; // Ignored (and should be null) for tiles/prototypes
	orientation? : Quaternion;

	type:PhysicalObjectType;
	
	// Bounding boxes are relative to the object's position (whether indicated externally or internally)
	tilingBoundingBox:Cuboid; // Used by tile trees to determine division, etc
	physicalBoundingBox:Cuboid;
	visualBoundingBox:Cuboid;
	
	isAffectedByGravity:boolean;
	isRigid:boolean;
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
	objects:KeyedList<PhysicalObject>;
	neighbors:KeyedList<RoomNeighbor>;
}

export interface Game {
	objectVisuals: KeyedList<ObjectVisual>;
	tilePalettes: KeyedList<Array<string>>;
	objectPrototypes: KeyedList<PhysicalObject>;
	rooms: KeyedList<Room>;
}
