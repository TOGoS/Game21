import KeyedList from '../KeyedList';
import {
	Maze,
	MazeNode,
	MazeLink,
	MazeLinkEndpoint,
} from '../graphmaze';
import GameDataManager from '../GameDataManager';


import {
	newType4Uuid,
	uuidUrn,
} from '../../tshash/uuids';

function newUuidRef():string { return uuidUrn(newType4Uuid()); }

// Turn each node into a room span.
// A room span being a set of rooms that are physically adjacent and should go together.

interface WorldlyLinkEndpointAttributes {
	roomRef? : string;
	direction? : number;
}

interface WorldlyNodeAttributes {
	linkRoomSides : KeyedList<WorldlyLinkEndpointAttributes>;
}

interface ProtoLinkAttributes {
	isBidirectional : boolean;
}

interface ProtoRoomLink {
	neighborRef : string;
	attributes : ProtoLinkAttributes;
}

interface ProtoRoom {
	id : string;
	protoLinks : (ProtoRoomLink|undefined)[];
}

/**
 * A set of rooms that are treated as a somewhat atomic unit
 * as far as content generation goes.
 */
interface RoomSpan {
	protoRooms : KeyedList<ProtoRoom>;
}

interface RoomSpanRequirements {
	exitsPerSide : number[];
}

const DIR_RIGHT = 0;
const DIR_DOWN  = 1;
const DIR_LEFT  = 2;
const DIR_UP    = 3;

function oppositeDirection( dir:number ):number {
	return (dir+2)%4;
}

function pickLinkDirection( usedDirections:number[] ):number {
	let minDir = 0;
	for( let i=0; i<4; ++i ) {
		if( usedDirections[i] < usedDirections[minDir] ) minDir = i;
	}
	return minDir;
}

function newProtoRoom():ProtoRoom {
	return { id: newUuidRef(), protoLinks: [undefined,undefined,undefined,undefined] }
}
function linkProtoRooms(pr0:ProtoRoom, dir:number, pr1:ProtoRoom, linkAttributes:ProtoLinkAttributes ) {
	if( pr0.protoLinks[dir] ) throw new Error("Can't connect "+pr0.id+" "+dir+"-wise to "+pr1.id+"; link already exists");
	const rid = oppositeDirection(dir);
	if( pr1.protoLinks[rid] ) throw new Error("Can't connect "+pr1.id+" "+rid+"-wise to "+pr0.id+"; link already exists");
	pr0.protoLinks[dir] = {neighborRef:pr1.id, attributes:linkAttributes};
	pr1.protoLinks[rid] = {neighborRef:pr0.id, attributes:linkAttributes}
}

class GraphWorldifier {
	public constructor( protected gdm:GameDataManager, protected maze:Maze ) { }
	
	protected linkDirections:KeyedList<number> = {};
	protected nodeSpanRequirements:KeyedList<RoomSpanRequirements> = {};
	protected nodeSpans:KeyedList<RoomSpan> = {};
	
	protected generateSpan(reqs:RoomSpanRequirements):RoomSpan {
		// Is this where 'generate nice room spans' code might go?
		// e.g. try generating a cavey room or something
		const protoRooms:KeyedList<ProtoRoom> = {};
		const openSides = [1,1,1,1];
		let protoRoom = newProtoRoom();
		protoRooms[protoRoom.id] = protoRoom;
		for( let i=0; i<reqs.exitsPerSide.length; ++i ) {
			if( reqs.exitsPerSide[i] > openSides[i] ) {
				// We gotta dig in a perpendicular direction.
				const digDir = ((i+1) + Math.floor(Math.random()*2)*2) % 4;
				const newRoom = newProtoRoom();
				linkProtoRooms(protoRoom, digDir, newRoom, {isBidirectional:true});
				protoRoom = newRoom;
				++openSides[i];
				++openSides[oppositeDirection(i)];
			}
		}
		return { protoRooms };
	}
	
	protected calculateNodeSpanRequirements( gn:MazeNode ):RoomSpanRequirements {
		const linkCounts = [0,0,0,0];
		// Count number of links that must point each direction
		for( let linkNumber=0; linkNumber<gn.linkIds.length; ++linkNumber ) {
			const linkId = gn.linkIds[linkNumber];
			const link = this.maze.links[linkId];
			const linkDir:number|undefined = this.linkDirections[linkId]; 
			if( linkDir ) {
				const isForward = (link.endpoint0.nodeId == gn.id && link.endpoint0.linkNumber == linkNumber);
				const dir = isForward ? linkDir : oppositeDirection(linkDir);
				++linkCounts[dir];
			}
		}
		// Pick directions for any undecided links
		for( let linkNumber=0; linkNumber<gn.linkIds.length; ++linkNumber ) {
			const linkId = gn.linkIds[linkNumber];
			const link = this.maze.links[linkId];
			const linkDir:number|undefined = this.linkDirections[linkId];
			if( linkDir == undefined ) {
				const dir = pickLinkDirection(linkCounts);
				++linkCounts[dir];
				const isForward = (link.endpoint0.nodeId == gn.id && link.endpoint0.linkNumber == linkNumber);
				this.linkDirections[linkId] = isForward ? dir : oppositeDirection(dir);
			}
		}
		
		const exitsPerSide = [0,0,0,0];
		for( let linkNumber=0; linkNumber<gn.linkIds.length; ++linkNumber ) {
			const linkId = gn.linkIds[linkNumber];
			const link = this.maze.links[linkId];
			const linkDir:number|undefined = this.linkDirections[linkId];
			if( !linkDir ) throw new Error("linkDir should have been popualted");
			const isForward = (link.endpoint0.nodeId == gn.id && link.endpoint0.linkNumber == linkNumber);
			const dir = isForward ? linkDir : oppositeDirection(linkDir);
			++exitsPerSide[dir];
		}
		return { exitsPerSide };
	}
	
	public run() {
		for( let linkId in this.maze.links ) {
			const link = this.maze.links[linkId];
			if( !link.allowsForwardMovement && !link.allowsBackwardMovement ) {
				// Some kind of window?
			} else if( !link.allowsBackwardMovement ) {
				this.linkDirections[linkId] = DIR_DOWN;
			} else if( !link.allowsForwardMovement ) {
				this.linkDirections[linkId] = DIR_UP;
			}
		}
		for( let n in this.maze.nodes ) {
			const node = this.maze.nodes[n];
			const spanReqs = this.nodeSpanRequirements[n] = this.calculateNodeSpanRequirements(node);
			this.nodeSpans[n] = this.generateSpan(spanReqs);
		}
		// TODO: link the spans
		for( let linkId in this.maze.links ) {
			// Create room for lock links
			// find rooms of neighboring spans
			// join rooms
		}
	}
}
