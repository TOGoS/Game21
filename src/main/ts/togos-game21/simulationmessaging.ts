import Vector3D from './Vector3D';
import SimulationMessage from './SimulationMessage';
import EntitySystemBusMessage from './EntitySystemBusMessage';

/**
 * [room ID, entity key, (subsystem/attachment zone key, item key)*]
 * 
 * Room ID can be thought of as the 'attachment zone ID' for the entire world.
 * 
 * ROOMID_* constants have special meaning when used as room IDs in an entity path.
 * 
 * In place of an an attachment zone key,
 *   '@structureoffset' means - thing at the following position (encoded as "x,y,z")
 *   one level within the entity's structure.
 *   Multiple '@structureoffset' 'x,y,z's may be needed for things deeply nested in a complex structure.
 */
export type EntityPath = string[];

export const AT_STRUCTURE_OFFSET = '@structureoffset';

export function entityPathToString(path:EntityPath) {
	// TODO: Don't encode ":"
	return "g21-item://"+path.map( encodeURIComponent ).join("/");
}

export const ROOMID_FINDENTITY = 'find-entity'; // Wherever the entity is
export const ROOMID_SIMULATOR = 'simulator'; // The simulation itself (entity ID ignored?)
export const ROOMID_EXTERNAL = 'external'; // For referring to recipients outside the simulation

export const XMSN_SPACE = "http://ns.nuke24.net/Game21/TransmissionMedia/Space";
export const XMSN_COPPER = "http://ns.nuke24.net/Game21/TransmissionMedia/Copper";

export const CHAN_ANALOG_1 = 1;
export const CHAN_ANALOG_2 = 2;
// More analog channels?
export const CHAN_SNS = 101; // Simple number signaling!  Payload consists of a single byte.
export const CHAN_ETHERNET = 8023; // Data assumed to be Ethernet Type II frames


/**
 * Will result in a HearText message on any entity that can hear it
 */
export interface SpeakTextAction {
	classRef: "http://ns.nuke24.net/Game21/SimulationAction/SpeakText";
	voiceRef: string;
	speakerName: string;
	originRoomRef: string;
	originPosition: Vector3D;
	loudness: number; // Determines how far the sound travels
	text: string;
}

/**
 * Initiate the simulation of sending a data packet
 * If the packet makes it to an object that can receive it,
 * that object will get a ["/receivedatapacket", <packet data as Uint8Array>] message
 * (reception will not necessarily be implemented using a ReceiveMessageAction).
 */
export interface TransmitWireSignalAction {
	classRef: "http://ns.nuke24.net/Game21/SimulationAction/TransmitWireSignal";
	originRoomRef: string;
	originPosition: Vector3D;
	direction: Vector3D;
	transmissionMediumRef: string;
	power: number;
	channelId: number;
	payload: Uint8Array;
}

export interface InduceSystemBusMessageAction {
	classRef: "http://ns.nuke24.net/Game21/SimulationAction/InduceSystemBusMessage";
	entityPath: EntityPath;
	busMessage: EntitySystemBusMessage;
	replyPath?: EntityPath;
}

// Ha ha, it is probably unnecessary because
// entities can morph themselves?
export interface ModifyEntityAction {
	classRef: "http://ns.nuke24.net/Game21/SimulationAction/ModifyEntity";
	entityPath: EntityPath;
	resetEntityClassRef?: string;
	resetToClassDefaults?: boolean;
	removeEntity?: boolean;
}

export type SimulationAction =
	InduceSystemBusMessageAction |
	ModifyEntityAction |
	TransmitWireSignalAction |
	SpeakTextAction;
