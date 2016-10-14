import Vector3D from './Vector3D';

/**
 * [room ID, entity key, (attachment zone ID, item key)*]
 * 
 * Room ID can be thought of as the 'attachment zone ID' for the entire world.
 * 
 * ROOMID_* constants have special meaning when used as room IDs in an entity path.
 */
export type EntityPath = string[];

export function entityPathToString(path:EntityPath) {
	// TODO: Don't encode ":"
	return "g21-item://"+path.map( encodeURIComponent ).join("/");
}

export const ROOMID_FINDENTITY = 'find-entity'; // Wherever the entity is
export const ROOMID_SIMULATOR = 'simulator'; // The simulation itself (entity ID ignored?)
export const ROOMID_EXTERNAL = 'external'; // For referring to recipients outside the simulation

// Same format as an OSC message, minus the type header
export type EntityMessageData = any[];

export const XMSN_SPACE = "http://ns.nuke24.net/Game21/TransmissionMedia/Space";
export const XMSN_COPPER = "http://ns.nuke24.net/Game21/TransmissionMedia/Copper";

export const CHAN_ANALOG_1 = 1;
export const CHAN_ANALOG_2 = 2;
// More analog channels?
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

export interface SendAnalogValueAction {
	classRef: "http://ns.nuke24.net/Game21/SimulationAction/SendAnalogValue";
	originRoomRef: string;
	originPosition: Vector3D;
	direction: Vector3D;
	transmissionMediumRef: string;
	channelId: number;
	value: number;
}

/**
 * Initiate the simulation of sending a data packet
 * If the packet makes it to an object that can receive it,
 * that object will get a ["/receivedatapacket", <packet data as Uint8Array>] message
 * (reception will not necessarily be implemented using a ReceiveMessageAction).
 */
export interface SendDataPacketAction {
	classRef: "http://ns.nuke24.net/Game21/SimulationAction/SendDataPacket";
	originRoomRef: string;
	originPosition: Vector3D;
	direction: Vector3D;
	transmissionMediumRef: string;
	channelId: number;
	data: Uint8Array;
}

/**
 * Deliver a message directly to some entity
 * without simulating the transport of the message.
 */
export interface ReceiveMessageAction {
	classRef: "http://ns.nuke24.net/Game21/SimulationAction/ReceiveMessage";
	entityPath: EntityPath;
	// TODO: Replace with a proper SimulationMessage type, roughly mirroring SimulationActions
	payload: EntityMessageData;
	// Do we want entities to be able to be able to reply to messages in certain situations?
	// Maybe messages aren't that high-level a thing?
	replyPath?: EntityPath;
}

export type SimulationAction = SendAnalogValueAction|SendDataPacketAction|ReceiveMessageAction|SpeakTextAction;
