import ObjectVisual, {MAObjectVisual} from './ObjectVisual';
import Cuboid from './Cuboid';
import Quaternion from './Quaternion';
import KeyedList from './KeyedList';
import Vector3D from './Vector3D';
import SurfaceMaterial from './SurfaceMaterial';

import { deepFreeze } from './DeepFreezer';

export type ProtoObjectRef = string;
export type RoomRef = string;
export type EntityClassRef = string;
export type EntityState = KeyedList<any>;

export const EMPTY_STATE = deepFreeze({});

export interface RoomLocation {
	roomRef : string;
	position : Vector3D;
}

export interface RoomNeighbor {
	offset:Vector3D;
	/**
	 * The room's bounding box, relative to its offset.
	 * This is duplicated from the room's own data.
	 */
	bounds:Cuboid;
	roomRef:RoomRef;
}

export enum StructureType {
	NONE = 0, // For entirely non-physical objects
	INDIVIDUAL = 1, // No subdivisions
	TILE_TREE = 2,
	STACK = 3, // A bunch of things in one spot!
}

/**
 * These should be considered immutable.
 */
export interface EntityClass {
	structureType : StructureType;
	debugLabel? : string;
	
	// Thoughts:
	// bounding boxes need to be overridden sometimes,
	// e.g. player crouching.
	// maybe these bounding boxes are just limits,
	// and finer-grained collision detection uses some to-be-determined data?
	//   shapeFunc : (state:EntityState) => Shape // or somesuch
	
	// Bounding boxes are relative to the object's position (whether indicated externally or internally)
	tilingBoundingBox:Cuboid; // Used by tile trees to determine division, etc
	physicalBoundingBox:Cuboid;
	visualBoundingBox:Cuboid;
	
	isAffectedByGravity?:boolean;
	isSolid?:boolean; // things can collide with it/it can collide with things
	opacity?:number; // For space-filling trees, this should be something like the average of contained items' opacities

	mass?:number;
	bounciness?:number;
	coefficientOfFriction?:number; // How rubby is it?
	climbability?:number; // 0 = only as much as friction allows; 1 = anyone can stick themself to it, even stupid babies with no grip strength.
	normalWalkingSpeed? : number; // Normal maximum speed attained while walking
	maxWalkingForce? : number; // Maximum force (newtons) that can be exerted along ground when walking; may also apply to climbing
	climbingSkill? : number; // can climb things with 1-climbingSkill climbability; default = 0
	normalClimbingSpeed? : number; // Normal maximum speed attained while climbing; default = walking speed
	
	visualRef? : string;
}

export interface Entity {
	id?: string;
	classRef : EntityClassRef;
	debugLabel? : string;
	/**
	 * Arbitrary additional values about the object's state
	 * which may be used by behavior and rendering
	 */ 
	state? : KeyedList<any>;
	
	desiredMovementDirection? : Vector3D;
}

/**
 * A room's link to an object that resides within it
 */
export interface RoomEntity {
	position : Vector3D; // Ignored (and should be null) for tiles/prototypes
	velocityPosition? : Vector3D; // Separate position for calculating movement when primary position is stepped
	orientation? : Quaternion; // Assume identify if undefined
	velocity? : Vector3D; // Assume 0,0,0 if undefined
	
	/** The game object itself */
	entity : Entity;
}

export interface TileTreeEntity {
	entity : Entity;
	orientation : Quaternion;
}

export type TileEntityPalette = Array<TileTreeEntity|null>;

export interface TileTree extends EntityClass {
	xDivisions:number;
	yDivisions:number;
	zDivisions:number;
	childEntityPaletteRef:string;
	childEntityIndexes:number[];
}

export interface Room {
	bounds : Cuboid;
	roomEntities : KeyedList<RoomEntity>;
	neighbors : KeyedList<RoomNeighbor>;
}

/**
 * Theoretical structure.
 * Since the set of data making up a game might become really large,
 * it will be distributed and not directly accessible from a single object.
 * Instead, sub-objects would be DistributedBucketMaps
 */
export interface Game {
	materials: KeyedList<SurfaceMaterial>;
	materialPalettes: KeyedList<Array<string|undefined>>;
	maObjectVisuals: KeyedList<MAObjectVisual>;
	objectVisuals: KeyedList<ObjectVisual>;
	tilePalettes: KeyedList<TileEntityPalette>;
	entityClasses: KeyedList<EntityClass>;
	rooms: KeyedList<Room>;
	time: number; // Current time in the world
}

export const HUNIT_CUBE:Cuboid = deepFreeze(new Cuboid(-0.5,-0.5,-0.5, +0.5,+0.5,+0.5));
