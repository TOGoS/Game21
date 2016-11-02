import Vector3D from './Vector3D';
import EntitySystemBusMessage from './EntitySystemBusMessage';
import { EntityPath } from './simulationmessaging';

interface ProximalEvent {
	originOffset? : Vector3D;
}

export interface ItemPickedUp extends ProximalEvent {
	classRef: "http://ns.nuke24.net/Game21/SimulationMessage/ItemPickedUp";
	itemClassRef: string;
	pickerPath: EntityPath;
}

export interface SimpleEventOccurred extends ProximalEvent {
	// "I really want to get this done now."
	classRef: "http://ns.nuke24.net/Game21/SimulationMessage/SimpleEventOccurred";
	eventCode : string;
}

export interface TextHeard extends ProximalEvent {
	classRef: "http://ns.nuke24.net/Game21/SimulationMessage/TextHeard";
	loudness: number; // How loud was it when you heard it?
	voiceRef: string;
	speakerName: string;
	text: string;
}

/*
export interface InternalBusMessageReceived {
	classRef: "http://ns.nuke24.net/Game21/SimulationMessage/InternalBusMessageReceived";
	busMessage: EntitySystemBusMessage;
}
*/

export type ProximalSimulationMessage = SimpleEventOccurred|ItemPickedUp|TextHeard;
export type SimulationMessage = SimpleEventOccurred|ItemPickedUp|TextHeard;

export default SimulationMessage;
