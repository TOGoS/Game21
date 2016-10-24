/// <reference path="../../node.d.ts"/>
/// <reference path="../../Promise.d.ts"/>

import KeyedList from '../KeyedList';
import {
	Maze,
	MazeNode,
	MazeLink,
	MazeLinkEndpoint,
	KeySet,
} from '../graphmaze';
import GameDataManager from '../GameDataManager';
import {
	newType4Uuid,
	uuidUrn,
} from '../../tshash/uuids';

import AABB from '../AABB';
import { makeAabb } from '../aabbs';
import Vector3D from '../Vector3D';
import { ZERO_VECTOR } from '../vector3ds';
import {
	Room,
	RoomEntity,
	RoomNeighbor,
} from '../world';
import {
	makeTileTreeRef,
} from '../worldutil';
import * as dat from '../maze1demodata';

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
	interSpan : boolean;
	isBidirectional : boolean;
}

interface ProtoRoomLink {
	neighborRef : string;
	attributes : ProtoLinkAttributes;
}

interface ProtoRoom {
	id : string;
	protoLinks : (ProtoRoomLink|undefined)[];
	doors : KeySet;
}

/**
 * A set of rooms that are treated as a somewhat atomic unit
 * as far as content generation goes.
 */
interface ProtoRoomSpan {
	id : string;
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
	return { id: newUuidRef(), protoLinks: [undefined,undefined,undefined,undefined], doors: {} };
}
function linkProtoRooms(pr0:ProtoRoom, dir:number, pr1:ProtoRoom, linkAttributes:ProtoLinkAttributes ) {
	if( pr0.protoLinks[dir] ) throw new Error("Can't connect "+pr0.id+" "+dir+"-wise to "+pr1.id+"; link already exists");
	const rid = oppositeDirection(dir);
	if( pr1.protoLinks[rid] ) throw new Error("Can't connect "+pr1.id+" "+rid+"-wise to "+pr0.id+"; link already exists");
	pr0.protoLinks[dir] = {neighborRef:pr1.id, attributes:linkAttributes};
	pr1.protoLinks[rid] = {neighborRef:pr0.id, attributes:linkAttributes}
}

function neighborOffset( bounds:AABB, dir:number, nBounds:AABB ):Vector3D {
	switch( dir ) {
	case DIR_RIGHT: return {x:bounds.maxX-nBounds.minX, y:0, z:0};
	case DIR_LEFT:  return {x:bounds.minX-nBounds.maxX, y:0, z:0};
	case DIR_DOWN:  return {x:0, y:bounds.maxY-nBounds.minY, z:0};
	case DIR_UP:    return {x:0, y:bounds.minY-nBounds.maxY, z:0};
	default: throw new Error("Bad direction: "+dir);
	}
}

class Bitmap {
	public data:number[];
	public constructor(protected width:number, protected height:number, protected depth:number) {
		this.data = new Array<number>(width*height*depth);
	}
	
	public fill(x0:number, y0:number, z0:number, x1:number, y1:number, z1:number, v:number) {
		for( let z=z0; z<z1; ++z ) {
			for( let y=y0; y<y1; ++y ) {
				for( let x=x0; x<x1; ++x ) {
					const i = x + y*(this.width) + z*(this.width*this.height);
					this.data[i] = v;
				}
			}
		}
	}
}

function nodeSpanId(nodeId:number|string):string { return "node"+nodeId; }
function linkSpanId(linkId:number|string):string { return "link"+linkId; }

class GraphWorldifier {
	public constructor( protected gdm:GameDataManager, protected maze:Maze ) { }
	
	protected linkDirections:KeyedList<number> = {};
	protected nodeSpanRequirements:KeyedList<RoomSpanRequirements> = {};
	protected protoRoomSpans:KeyedList<ProtoRoomSpan> = {};
	protected _tileEntityPaletteRef:string|undefined;
	
	public set tileEntityPaletteRef(t:string) {
		this._tileEntityPaletteRef = t;
	}
	public get tileEntityPaletteRef() {
		if( this._tileEntityPaletteRef == null ) throw new Error("No tile entity palette ref!");
		return this._tileEntityPaletteRef;
	}
	
	protected generateNodeSpan(id:string, reqs:RoomSpanRequirements):ProtoRoomSpan {
		// Is this where 'generate nice room spans' code might go?
		// e.g. try generating a cavey room or something
		const spanProtoRooms:KeyedList<ProtoRoom> = {};
		const openSides = [1,1,1,1];
		let protoRoom = newProtoRoom();
		spanProtoRooms[protoRoom.id] = protoRoom;
		for( let i=0; i<reqs.exitsPerSide.length; ++i ) {
			while( reqs.exitsPerSide[i] > openSides[i] ) {
				// We gotta dig in a perpendicular direction.
				const digDir = ((i+1) + Math.floor(Math.random()*2)*2) % 4;
				console.log("Not enough exit to span "+id+" in direction "+i+"; digging "+digDir+"ward");
				const newRoom = newProtoRoom();
				linkProtoRooms(protoRoom, digDir, newRoom, {
					isBidirectional: true,
					interSpan: false,
				});
				spanProtoRooms[newRoom.id] = newRoom;
				++openSides[i];
				++openSides[oppositeDirection(i)];
				protoRoom = newRoom;
			}
		}
		return this.protoRoomSpans[id] = { id, protoRooms:spanProtoRooms };
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
			if( linkDir == undefined ) throw new Error("linkDir should have been popualted");
			const isForward = (link.endpoint0.nodeId == gn.id && link.endpoint0.linkNumber == linkNumber);
			const dir = isForward ? linkDir : oppositeDirection(linkDir);
			++exitsPerSide[dir];
		}
		return { exitsPerSide };
	}
	
	protected generateLinkSpan(link:MazeLink, locks:KeySet):ProtoRoomSpan {
		const protoRooms:KeyedList<ProtoRoom> = {};
		const newRoom = newProtoRoom();
		newRoom.doors = locks;
		protoRooms[newRoom.id] = newRoom;
		const id = linkSpanId(link.id);
		return this.protoRoomSpans[id] = { id:id, protoRooms };
	}
	
	protected findRoomWithOpenWall(span:ProtoRoomSpan, direction:number):ProtoRoom {
		let roomCount = 0;
		for( let r in span.protoRooms ) {
			const room = span.protoRooms[r];
			if( room.protoLinks[direction] == null ) return room;
			++roomCount;
		}
		console.error("Span "+span.id+": "+JSON.stringify(span,null,"\t"));
		throw new Error("No open "+direction+" wall in span "+span.id+"; size="+roomCount);
	}
	
	protected connectSpans(span0Id:string, dir:number, span1Id:string, isBidirectional:boolean):void {
		const span0 = this.protoRoomSpans[span0Id];
		const span1 = this.protoRoomSpans[span1Id];
		const rid = oppositeDirection(dir);
		const room0 = this.findRoomWithOpenWall(span0, dir);
		const room1 = this.findRoomWithOpenWall(span1, rid);
		const linkAttributes = { isBidirectional, interSpan: true }
		linkProtoRooms( room0, dir, room1, linkAttributes );
	}
	
	protected protoRoomSpanToWorldRooms(span:ProtoRoomSpan):void {
		for( let pr in span.protoRooms ) {
			const protoRoom = span.protoRooms[pr];
			// TODO: Make more interesting rooms, maybe with the help of generateSpan
			// have it figure general size and shape so we know how to place neighbors ahead of time
			const roomWidth = 8, roomHeight = 8, roomDepth = 1;
			const roomBounds:AABB = makeAabb(-roomWidth/2, -roomHeight/2, -roomDepth/2, roomWidth/2, roomHeight/2, roomDepth/2);
			const tileBmp = new Bitmap(roomWidth,roomHeight,roomDepth);
			tileBmp.fill(0,0,0,roomWidth,roomHeight,roomDepth,1);
			tileBmp.fill(2,2,2,roomWidth-2,roomHeight-2,roomDepth-2,1);
			// TODO: Add locked doors, items
			const neighbors:KeyedList<RoomNeighbor> = {};
			const LADDER_IDX = 5;
			for( let i=0; i<4; ++i ) {
				const protoLink = protoRoom.protoLinks[i];
				if( protoLink ) {
					const hallWidth = protoLink.attributes.interSpan ? 4 : 2;
					const cx = roomWidth/2, cy=roomHeight/2;
					const hhw = hallWidth/2;
					switch( i ) {
					case DIR_RIGHT:
						tileBmp.fill(cx, cy-hhw, 0, roomWidth,  cy+hhw, 1, 0); break;
					case DIR_LEFT :
						tileBmp.fill( 0, cy-hhw, 0,        cx,  cy+hhw, 1, 0); break;
					case DIR_DOWN :
						tileBmp.fill(cx-hhw, cy, 0, cx+hhw, roomHeight, 1, 0);
						if( protoLink.attributes.isBidirectional ) {
							tileBmp.fill(cx, cy, 0, cx+1,roomHeight, 1, LADDER_IDX)
						}
						break;
					case DIR_UP   :
						tileBmp.fill(cx-hhw,  0, 0, cx+hhw,         cy, 1, 0);
						if( protoLink.attributes.isBidirectional ) {
							tileBmp.fill(cx, 0, 0, cx+1, cy, 1, LADDER_IDX)
						}
						break;
					}
					
					neighbors["n"+i] = {
						bounds: roomBounds,
						roomRef: protoLink.neighborRef,
						offset: neighborOffset(roomBounds, i, roomBounds) // Eh
					}
				}
			}
			const room:Room = {
				bounds: roomBounds,
				roomEntities: {
					[newUuidRef()]: {
						position: ZERO_VECTOR,
						entity: { classRef: makeTileTreeRef(this.tileEntityPaletteRef, roomWidth, roomHeight, roomDepth, tileBmp.data, this.gdm, {infiniteMass:true}) }
					}
				}, neighbors
			}
			this.gdm.storeObject<Room>( room, protoRoom.id );
		}
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
			this.generateNodeSpan(nodeSpanId(n), spanReqs);
		}
		for( let linkId in this.maze.links ) {
			const link = this.maze.links[linkId];
			const linkDir = this.linkDirections[linkId];
			if( linkDir == undefined ) {
				throw new Error("Link "+linkId+" has no direction");
			}
			
			let needsOwnRoom = false;
			for( let k in link.locks ) needsOwnRoom = true;
			
			const span0Id = nodeSpanId(link.endpoint0.nodeId);
			const span1Id = nodeSpanId(link.endpoint1.nodeId);
			let span2Id:string, span3Id:string;
			if( needsOwnRoom ) {
				const linkSpan = this.generateLinkSpan(link, link.locks);
				span2Id = span3Id = linkSpan.id;
			} else {
				span2Id = span1Id;
				span3Id = span0Id; 
			}
			
			this.connectSpans(span0Id, linkDir, span2Id, link.allowsForwardMovement && link.allowsBackwardMovement);
			if( span2Id != span1Id ) this.connectSpans(span1Id, oppositeDirection(linkDir), span3Id, link.allowsForwardMovement && link.allowsBackwardMovement);
		}
		
		for( let spanId in this.protoRoomSpans ) {
			const span = this.protoRoomSpans[spanId];
			this.protoRoomSpanToWorldRooms(span);
		}
		
		const span0 = this.protoRoomSpans[nodeSpanId(0)];
		for( let r in span0.protoRooms ) {
			return span0.protoRooms[r].id;
		}
		throw new Error("No start room??");
	}
}

import { sha1Urn } from '../../tshash/index';
import Datastore from '../Datastore';
import HTTPHashDatastore from '../HTTPHashDatastore';
import { SaveGame } from '../Maze1';

if( typeof require != 'undefined' && typeof module != 'undefined' && require.main === module ) {
	const readStream = ( s:NodeJS.ReadableStream ):Promise<string[]> => {
		return new Promise( (resolve,reject) => {
			const parts:string[] = [];
			s.on('data', (dat:string) => parts.push(dat));
			s.on('end', () => resolve(parts) );
			s.on('error', (err:any) => reject(err) );
			s.read();
		});
	}
	
	const dataIdent = sha1Urn;
	const ds:Datastore<Uint8Array> = HTTPHashDatastore.createDefault();
	const gdm:GameDataManager = new GameDataManager(ds);
	readStream(process.stdin).then( (parts) => {
		const maze:Maze = JSON.parse(parts.join(""));
		
		return dat.initData(gdm).then(() => gdm.fetchTranslation( dat.tileEntityPaletteId )).then( (tepRef) => {
			const worldifier:GraphWorldifier = new GraphWorldifier(gdm, maze);
			worldifier.tileEntityPaletteRef = tepRef;
			return worldifier;
		});
	}).then( (worldifier) => {
		const startRoomId = worldifier.run();
		const startRoom = gdm.getMutableRoom(startRoomId)
		startRoom.roomEntities[dat.playerEntityId] = {
			position: ZERO_VECTOR,
			entity: { classRef: dat.playerEntityClassId }
		}
		gdm.flushUpdates().then( (rootNodeUri) => {
			const sg:SaveGame = {
				gameDataRef: rootNodeUri,
				playerId: dat.playerEntityId,
				rootRoomId: startRoomId,
			};
			return gdm.storeObject(sg);
		}).then( (saveRef) => {
			console.log("Saved world as "+saveRef);
		});
	}).catch( (err) => {
		console.error("Error! ", err);
		process.exit(1);
	});
}
