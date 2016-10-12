import Vector3D from './Vector3D';

/**
 * [room ID, entity key, (attachment zone ID, item key)*]
 * 
 * Room ID can be thought of as the 'attachment zone ID' for the entire world.
 * 
 * ROOMID_* constants have special meaning when used as room IDs in an entity path. 
 */
export type EntityPath = string[];

export const ROOMID_FINDENTITY = 'find-entity'; // Wherever the entity is
export const ROOMID_SIMULATION = 'simulation'; // The simulation itself (entity ID ignored?)
export const ROOMID_EXTERNAL = 'external'; // For referring to recipients outside the simulation

// Same format as an OSC message, minus the type header
export type EntityMessageData = any[];

export const XMSN_SPACE = "http://ns.nuke24.net/Game21/TransmissionMedium/Space";
export const XMSN_COPPER = "http://ns.nuke24.net/Game21/TransmissionMedium/Copper";

export const ACTYPE_SENDPACKET = "SendPacket";
export const ACTYPE_RECVPACKET = "ReceivePacket";

export const CHAN_ANALOG_1 = 1;
export const CHAN_ANALOG_2 = 2;
// More analog channels?
export const CHAN_ETHERNET = 802;

export interface SimulationAction {
	actionTypeId : string;
}

/**
 * Initiate the simulation of sending a data packet
 * If the packet makes it to an object that can receive it,
 * that object will get a ["/receivedatapacket", <packet data as Uint8Array>] message.
 * 
 * Data is assumed to be Ethernet Type II frame unl
 */
export interface SendPacketAction extends SimulationAction {
	actionTypeId: "SendPacket";
	originRoomId: string;
	originPosition: Vector3D;
	direction: Vector3D;
	transmissionMediumId: string;
	channelId: number;
	data: Uint8Array;
}

export interface ReceiveMessageAction extends SimulationAction {
	actionTypeId: "ReceiveMessage";
	entityPath: EntityPath;
	payload: EntityMessageData;
	// Do we want entities to be able to be able to reply to messages in certain situations?
	// Maybe messages aren't that high-level a thing?
	replyPath?: EntityPath;
}
