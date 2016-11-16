import {
	EntityPath
} from './simulationmessaging';
import Vector3D from './Vector3D';
import TimeTargetted from './TimeTargetted';
import EntitySystemBusMessage from './EntitySystemBusMessage';
import MinHeap  from './MinHeap';

// Keys for singleton systems

export const ESSKEY_PROXIMALEVENTDETECTOR = "proximaleventdetector";
export const ESSKEY_VISION = "vision";

// Commit this change later, ha ha aha.
export const ESSCR_CONDUCTOR_NETWORK : "http://ns.nuke24.net/Game21/EntitySubsystem/ConductorNetwork" = "http://ns.nuke24.net/Game21/EntitySubsystem/ConductorNetwork";
export const ESSCR_VISION : "http://ns.nuke24.net/Game21/EntitySubsystem/Vision" = "http://ns.nuke24.net/Game21/EntitySubsystem/Vision";

export interface ConductorLink {
	endpoint0Index : number;
	endpoint1Index : number;
	mediumIndex : number;
	area : number;
	length : number;
}

export interface ConductorNetwork {
	classRef: typeof ESSCR_CONDUCTOR_NETWORK;
	nodePositions : Vector3D[];
	mediumRefs : string[];
	links : ConductorLink[];
	subNetworks? : ConductorNetwork[];
	subNetworkPositions? : Vector3D[];
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
	classRef: typeof ESSCR_VISION;
	eyePositions: Vector3D[];
	maxViewDistance : number;
	isEnabled : boolean; /** Do scan at next opportunity */
	isOmniscient? : boolean;
	lastScanTime? : number;
	minScanInterval : number; /** Number of seconds between scans */
	disableAfterNextScan? : boolean;
	sceneExpressionRef? : string;
}

export interface InterEntityBusBridge {
	classRef : "http://ns.nuke24.net/Game21/EntitySubsystem/InterEntityBusBridge";
	forwardEntityPath : EntityPath;
}

export type EntitySubsystem =
	Appendage |
	Button |
	ConductorNetwork |
	EntityMorpher |
	InterEntityBusBridge |
	MessageDelayer |
	ProximalEventDetector |
	SimpleComputer |
	Vision;

export default EntitySubsystem;
