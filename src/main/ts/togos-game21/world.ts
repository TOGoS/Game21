import Quaternion from './Quaternion';
import KeyedList from './KeyedList';
import Vector3D from './Vector3D';
import AABB from './AABB';

import EntitySubsystem from './EntitySubsystem';
import EntitySystemBusMessage, { MessageBusSystem } from './EntitySystemBusMessage';
import TimeTargetted from './TimeTargetted';

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
	bounds:AABB;
	roomRef:RoomRef;
}

export enum StructureType {
	NONE = 0, // For entirely non-physical objects
	INDIVIDUAL = 1, // No subdivisions
	TILE_TREE = 2,
	STACK = 3, // A bunch of things in one spot!
	LIST = 4, // A set of RoomEntities
}

export interface AttachmentZone {
	maxVolume : number; // m³
	maxItemCount? : number; // e.g. hands can hold only one item
}

export const AZTYPE_BAG   = "http://ns.nuke24.net/Game21/AttachmentZoneTypes/Bag"  ; // Can hold a (conceptually) unordered set of items
export const AZTYPE_PANEL = "http://ns.nuke24.net/Game21/AttachmentZoneTypes/Panel"; // A 2D grid of connectors
export const AZTYPE_BOX   = "http://ns.nuke24.net/Game21/AttachmentZoneTypes/Box"  ; // A 3D volume with explicitly-placed contents
export const AZTYPE_HAND  = "http://ns.nuke24.net/Game21/AttachmentZoneTypes/Hand" ; // Can hold a single item of arbitrary size

export interface PegType {
	/** partner peg type ref => true, if attachable */
	partnersTo : KeyedList<boolean>;	
}

export interface AttachmentZoneClass {
	/** One of the AZTYPE_* constants */
	attachmentZoneTypeRef : string;
	
	// For panel-type zones
	pegTypeRef? : string;
	
	maxForce? : number; // Maximum force that the attachment can withstand; undefined=infinity
	mayPassPower? : boolean; // Default = false
	mayPassData?  : boolean; // Undefined = false
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
	tilingBoundingBox:AABB; // Used by tile trees to determine division, etc
	physicalBoundingBox:AABB;
	visualBoundingBox:AABB;
	
	isAffectedByGravity?:boolean;
	isSolid?:boolean; // things can collide with it/it can collide with things
	opacity?:number; // For space-filling trees, this should be something like the average of contained items' opacities

	mass?:number; // Null means infinity because zero is serializable as JSON and Infinity isn't.  ;P
	bounciness?:number;
	coefficientOfFriction?:number; // How rubby is it?
	climbability?:number; // 0 = only as much as friction allows; 1 = anyone can stick themself to it, even stupid babies with no grip strength.
	normalWalkingSpeed? : number; // Normal maximum speed attained while walking
	maxWalkingForce? : number; // Maximum force (newtons) that can be exerted along ground when walking; may also apply to climbing
	maxJumpImpulse? : number; // Maximum impulse (newton-seconds) that can be exerted against the floor for a jump
	maxClimbForce? : number; //
	maxFlyingForce? : number; // Maximum force that can be exerted against the universe so that an entity can maneuver itself in the air
	climbingSkill? : number; // can climb things with 1-climbingSkill climbability; default = 0
	normalClimbingSpeed? : number; // Normal maximum speed attained while climbing; default = walking speed
	
	/** @temporary-shortcut */
	isMaze1AutoPickup? : boolean;
	/** @temporary-shortcut */
	maze1InventorySize? : number;
	/** @temporary-shortcut ; replace with entity internal systems; this indicates the key class that will destroy a cheap door */
	cheapMaze1DoorKeyClassRef? : string;
	/** @temporary-shortcut */
	isMaze1Edible? : boolean;
	/** @temporary-shortcut */
	maze1NutritionalValue? : number;
	/** @temporary-shortcut */
	maze1Importance?: number;
	
	visualRef? : string;
	
	// By default this could be computed from tilingBoundingBox or something I guess
	storageVolume? : number;
	
	// keys are arbitrary and identify the specific zone on the item (e.g. 'pocket 1', 'pocket 2', 'belt loops').
	// Values are storage attachment zone class references
	
	attachmentZoneClasseRefs? : KeyedList<string>;
	
	/**
	 * @conceptual
	 * Internal systems determine how an entity behaves.
	 * Some entity class info (e.g. climbing skill) should be moved to system classes.
	 * e.g.
	 * - motor -> spends entity's energy attempting to climb when in contact with a direct power rail
	 *   (e.g. doors, lifts); may be locked or unlocked
	 * - doorbell -> powers something, may require a key
	 */
	defaultInternalSystems? : KeyedList<EntitySubsystem>;
}

export interface AttachmentEntity {
	position : Vector3D; // Can be ZERO_VECTOR for 'bag'-type attachment zones
	entity : Entity;
}

export interface AttachmentZone {
	classRef : string;
	items : KeyedList<AttachmentEntity>;
}

/**
 * A game object: class + internal state.
 * An entity does not necessarily know its own ID or anything about its surroundings.
 * A single entity instance may be referenced from multiple places
 * (which makes the name 'entity' a bit of a misnomer, since it implies 'a single thing with inherent identity').
 * Another object (a RoomEntity, a TileEntity) links an Entity to somewhere.
 */
export interface Entity extends MessageBusSystem {
	id?: string;
	classRef : EntityClassRef;
	debugLabel? : string;
	/**
	 * Arbitrary additional values about the object's state
	 * which may be used by behavior and rendering
	 */ 
	state? : KeyedList<any>;
	/**
	 * Overrides of the entity class's default internal systems.
	 * A key with value=undefined means this entity is lacking that system.
	 */
	internalSystems? : KeyedList<EntitySubsystem|undefined>;
	enqueuedBusMessages? : EntitySystemBusMessage[];
	
	desiredMovementDirection? : Vector3D;
	/**
	 * @temporary-shortcut
	 * Causes entity to automatically pick up items
	 * and activate things when touching them.
	 */
	desiresMaze1AutoActivation? : boolean;
	/**
	 * @temporary-shortcut
	 * A really simple keyed list of inventory items
	 * because I don't want to deal with attachment zones
	 * and the whole inventory UI thing yet.
	 */
	maze1Inventory? : KeyedList<Entity>;
	
	attachmentZones? : KeyedList<AttachmentZone>;
	storedEnergy? : number;
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

export interface RoomVisualEntity {
	position : Vector3D;
	velocity? : Vector3D;
	orientation? : Quaternion;

	entity? : Entity
	
	// If entity is unset, you may still be able to get visual info from: 
	state? : KeyedList<any>;
	visualRef? : string;
}

/**
 * A cell containing an entity which sits in the center, but might be rotated.
 * The entity's tiling bounding box should match the implied (by whatever contains it)
 * bounding box of the TileEntity.
 */
export interface TileEntity {
	entity : Entity;
	orientation : Quaternion;
}

export type TileEntityPalette = Array<TileEntity|null>;

export interface TileTree extends EntityClass {
	xDivisions:number;
	yDivisions:number;
	zDivisions:number;
	childEntityPaletteRef:string;
	childEntityIndexes:number[]; // Uint8Array should do, but that doesn't serialize as JSON
}

export interface Room {
	bounds : AABB;
	roomEntities : KeyedList<RoomEntity>;
	neighbors : KeyedList<RoomNeighbor>;
}
