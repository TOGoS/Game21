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
export const ESSCR_WIRED_NETWORK_PORT : "http://ns.nuke24.net/Game21/EntitySubsystem/WiredNetworkPort" = "http://ns.nuke24.net/Game21/EntitySubsystem/WiredNetworkPort";
export const ESSCR_VISION : "http://ns.nuke24.net/Game21/EntitySubsystem/Vision" = "http://ns.nuke24.net/Game21/EntitySubsystem/Vision";

export interface ConductorNode {
	position : Vector3D;
	/**
	 * Manhattan-normalized vector indicating the direction that this node 'points'
	 * for purposes of linking to nodes on other networks.
	 * Undefined if this is an entirely internal node.
	 */
	externallyFacing? : Vector3D;
	/** Indexes of all internal links that attach to this node */
	linkIndexes : number[];
}

export interface ConductorLink {
	endpoint0Index : number;
	endpoint1Index : number;
	mediumIndex : number;
	crossSectionalArea : number;
	length : number;
}

export interface ConductorNetwork {
	classRef: typeof ESSCR_CONDUCTOR_NETWORK;
	mediumRefs : (string|undefined)[];
	nodes : (ConductorNode|undefined)[];
	links : (ConductorLink|undefined)[];
	//subNetworks? : ConductorNetwork[];
	//subNetworkPositions? : Vector3D[];
}

/**
 * /<port>/signal <payload:string|array<byte>>
 */
export interface WiredNetworkPort {
	classRef: typeof ESSCR_WIRED_NETWORK_PORT,
	position: Vector3D,
	direction: Vector3D,
	channelId: number,
	normalTransmissionPower: number,
	transmissionMediumRef: string,
	/**
	 * Refers to a progra that will be called with vars:
	 *   payload:Uint8Array
	 */
	signalReceivedExpressionRef? : string;
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

/** Receives bus messages and does /something/ */
export interface SimpleComputer {
	classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/SimpleComputer";
	registerVariableNames? : string[];
	parameterVariableNames? : string[];
	// Will be called with arguments translated to corresponding parameter variables
	messageReceivedExpressionRef? : string;
}

/**
 * Reacts to the entity being poked.
 * 
 * Messages:
 * - /<button>/poke invoke the poke handler without requiring a 'physical' poke
 */
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

export type VisionScanMode = "line-of-sight"|"all";

export interface Vision {
	classRef: typeof ESSCR_VISION;
	eyePositions: Vector3D[];
	maxViewDistance : number;
	isEnabled : boolean; /** Do scan at next opportunity */
	isOmniscient? : boolean; // Is 'all' scan mode available?
	/** omniscient vision systems can go into line-of-sight mode if they choose to */
	scanMode?: VisionScanMode;
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
	Vision |
	WiredNetworkPort;

export default EntitySubsystem;
