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

/**
 * /delay <delay time> <message>
 */
export interface MessageDelayer {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/MessageDelayer";
	// Maybe actually a min heap?  Yeah that'd be good.
	messages : MinHeap<TimeTargetted<EntitySystemBusMessage>>[];
}

export interface ProximalEventDetector {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/ProximalEventDetector";
	// Will be called with ( event : event data )
	eventDetectedExpressionRef? : string;
}

/** Receives messages and does /something/ */
export interface SimpleComputer {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/SimpleComputer";
	registerVariableNames? : string[];
	parameterVariableNames? : string[];
	// Will be called with arguments translated to corresponding parameter variables
	messageReceivedExpressionRef? : string;
}

export interface Button {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/Button";
	pokedExpressionRef? : string;
}

export interface EntityMorpher {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/EntityMorpher";
}

/**
 * May also be an attachment zone!
 * In which case systemKey will match attachmentzone key.
 * 
 * Messages:
 * - /poke x y z # poke whatever's at x,y,z relative to the entity.  if holding something, offers it to the thing.
 */
export interface Appendage {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/Appendage";
	maxReachDistance?: number;
}

export interface Vision {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/Vision";
	eyePositions: Vector3D[];
	distance : number;
	sceneExpressionRef? : string;
}

export interface InterEntityBusBridge {
	classRef : "http://ns.nuke24.net/Game21/EntitySubsystem/InterEntityBusBridge";
	forwardEntityPath : EntityPath;
}

export type EntitySubsystem =
	Appendage |
	Button |
	Conductor |
	EntityMorpher |
	InterEntityBusBridge |
	MessageDelayer |
	ProximalEventDetector |
	SimpleComputer |
	Vision;

export default EntitySubsystem;
