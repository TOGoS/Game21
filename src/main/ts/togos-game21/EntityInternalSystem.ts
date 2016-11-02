// TODO: rename to Subsystem; the system is a bunch of subsystems put together.

import {
	EntityPath
} from './simulationmessaging';
import Vector3D from './Vector3D';
import TimeTargetted from './TimeTargetted';
import InternalBusMessage from './InternalBusMessage';
import MinHeap  from './MinHeap';

// Keys for singleton systems

export const EISKEY_PROXIMALEVENTDETECTOR = "proximaleventdetector";

export interface Conductor {
	classRef: "http://ns.nuke24.net/Game21/EntityInternalSystem/Conductor";
	mediumRef: string; // Same as message transmission mediums, e.g. "http://ns.nuke24.net/Game21/TransmissionMedia/Copper"
	endpointPositions : Vector3D[];
}

export interface MessageDelayer {
	classRef: "http://ns.nuke24.net/Game21/EntityInternalSystem/MessageDelayer";
	// Maybe actually a min heap?  Yeah that'd be good.
	messages : MinHeap<TimeTargetted<InternalBusMessage>>[];
}

export interface ProximalEventDetector {
	classRef: "http://ns.nuke24.net/Game21/EntityInternalSystem/ProximalEventDetector";
	// Will be called with ( event : event data )
	onEventExpressionRef? : string;
}

export interface Button {
	classRef: "http://ns.nuke24.net/Game21/EntityInternalSystem/Button";
	onTouchExpressionRef? : string;
}

export interface Vision {
	classRef: "http://ns.nuke24.net/Game21/EntityInternalSystem/Vision";
	eyePositions: Vector3D[];
	distance : number;
	onSceneExpressionRef? : string;
}

export interface InterEntityBusBridge {
	classRef: "http://ns.nuke24.net/Game21/EntityInternalSystem/InterEntityBusBridge";
	forwardTo : EntityPath;
}

export type EntityInternalSystem =
	Conductor |
	MessageDelayer |
	ProximalEventDetector |
	Button |
	Vision |
	InterEntityBusBridge;

export default EntityInternalSystem;
