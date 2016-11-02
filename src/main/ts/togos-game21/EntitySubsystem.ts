import {
	EntityPath
} from './simulationmessaging';
import Vector3D from './Vector3D';
import TimeTargetted from './TimeTargetted';
import EntitySystemBusMessage from './EntitySystemBusMessage';
import MinHeap  from './MinHeap';

// Keys for singleton systems

export const ESSKEY_PROXIMALEVENTDETECTOR = "proximaleventdetector";

export interface Conductor {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/Conductor";
	mediumRef: string; // Same as message transmission mediums, e.g. "http://ns.nuke24.net/Game21/TransmissionMedia/Copper"
	endpointPositions : Vector3D[];
}

export interface MessageDelayer {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/MessageDelayer";
	// Maybe actually a min heap?  Yeah that'd be good.
	messages : MinHeap<TimeTargetted<EntitySystemBusMessage>>[];
}

export interface ProximalEventDetector {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/ProximalEventDetector";
	// Will be called with ( event : event data )
	onEventExpressionRef? : string;
}

export interface Button {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/Button";
	onTouchExpressionRef? : string;
}

export interface Vision {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/Vision";
	eyePositions: Vector3D[];
	distance : number;
	onSceneExpressionRef? : string;
}

export interface InterEntityBusBridge {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/InterEntityBusBridge";
	forwardTo : EntityPath;
}

export type EntitySubsystem =
	Conductor |
	MessageDelayer |
	ProximalEventDetector |
	Button |
	Vision |
	InterEntityBusBridge;

export default EntitySubsystem;
