/// <reference path="../../node.d.ts"/>
/// <reference path="../../Promise.d.ts"/>

import KeyedList from '../KeyedList';
import {
	Maze,
	MazeNode,
	MazeLink,
	MazeLinkEndpoint,
	KeySet,
	ITEMCLASS_BLUEKEY,
	ITEMCLASS_YELLOWKEY,
	ITEMCLASS_REDKEY,
	ITEMCLASS_END,
	ITEMCLASS_START,
} from '../graphmaze';
import GameDataManager from '../GameDataManager';
import {
	newType4Uuid,
	uuidUrn,
} from '../../tshash/uuids';

import AABB from '../AABB';
import { makeAabb } from '../aabbs';
import Vector3D from '../Vector3D';
import { subtractVector } from '../vector3dmath'
import { ZERO_VECTOR } from '../vector3ds';
import SimplexNoise from '../../SimplexNoise';
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
	position : Vector3D;
}

interface ProtoRoom {
	id : string;
	bounds : AABB;
	protoRoomSpanRef : string;
	protoLinks : (ProtoRoomLink|undefined)[];
	doors : KeySet;
	
	styleId?:string;
	floorHeights?:number[];
	ceilingHeights?:number[];
}

/**
 * A set of rooms that are treated as a somewhat atomic unit
 * as far as content generation goes.
 */
interface ProtoRoomSpan {
	id : string;
	protoRooms : KeyedList<ProtoRoom>;
	node? : MazeNode;
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

/** Pick a direction for the a link! */
function pickLinkDirection( usedDirections:number[], link:MazeLink ):number {
	let hasLocks = false;
	for( let lock in link.locks ) hasLocks = true;
	
	if( link.allowsForwardMovement && !link.allowsBackwardMovement ) return DIR_DOWN;
	if( link.allowsBackwardMovement && !link.allowsForwardMovement ) return DIR_UP;
	
	// Sometimes pick one at random.
	if( !hasLocks && Math.random() < 0.25 ) {
		return randInt(0,3);
	}
	
	let minDirs:number[] = [];
	let minCount = Infinity;
	for( let d=0; d<4; ++d ) {
		if( hasLocks && (d == DIR_UP || d == DIR_DOWN) ) continue;
		if( usedDirections[d] == minCount ) {
			minDirs.push(d);
		} else if( usedDirections[d] < minCount ) {
			minDirs = [d];
			minCount = usedDirections[d];
		}
	}
	const horizontalDirs:number[] = [];
	const verticalDirs:number[] = [];
	for( let i in minDirs ) {
		const d = minDirs[i];
		switch( d ) {
		case DIR_LEFT:	case DIR_RIGHT: horizontalDirs.push(d); break;
		default: verticalDirs.push(d); break;
		}
	}
	minDirs = ( horizontalDirs.length >= verticalDirs.length ) ? horizontalDirs : verticalDirs;
	return minDirs[randInt(0,minDirs.length-1)];
}

function newProtoRoom(spanId:string, bounds:AABB):ProtoRoom {
	return {
		id: newUuidRef(),
		protoRoomSpanRef:spanId,
		bounds: bounds,
		protoLinks: [undefined,undefined,undefined,undefined],
		doors: {}
	};
}
function linkProtoRooms(pr0:ProtoRoom, pp0:Vector3D, dir:number, pr1:ProtoRoom, pp1:Vector3D, linkAttributes:ProtoLinkAttributes ) {
	if( pr0.protoLinks[dir] ) throw new Error("Can't connect "+pr0.id+" "+dir+"-wise to "+pr1.id+"; link already exists");
	const rid = oppositeDirection(dir);
	if( pr1.protoLinks[rid] ) throw new Error("Can't connect "+pr1.id+" "+rid+"-wise to "+pr0.id+"; link already exists");
	pr0.protoLinks[dir] = {neighborRef:pr1.id, attributes:linkAttributes, position:pp0};
	pr1.protoLinks[rid] = {neighborRef:pr0.id, attributes:linkAttributes, position:pp1}
}

function roomLeftFloorHeight(pr:ProtoRoom) {
	return pr.bounds.maxY-3;
}
function roomRightFloorHeight(pr:ProtoRoom) {
	return pr.bounds.maxY-3;
}

function linkProtoRoomsDefaultly(pr0:ProtoRoom, dir:number, pr1:ProtoRoom, linkAttributes:ProtoLinkAttributes ) {
	const y0l = roomLeftFloorHeight(pr0);
	const y0r = roomRightFloorHeight(pr0);
	const defaultLinkPositions0 = [
		{x:pr0.bounds.maxX, y:y0r, z:0},
		{x:0, y:pr0.bounds.maxY, z:0},
		{x:pr0.bounds.minX, y:y0l, z:0},
		{x:0, y:pr0.bounds.minY, z:0},
	];
	const y1l = roomLeftFloorHeight(pr1);
	const y1r = roomRightFloorHeight(pr1);
	const defaultLinkPositions1 = [
		{x:pr1.bounds.minX, y:y1l, z:0},
		{x:0, y:pr1.bounds.minY, z:0},
		{x:pr1.bounds.maxX, y:y1r, z:0},
		{x:0, y:pr1.bounds.maxY, z:0},
	];
	linkProtoRooms(pr0, defaultLinkPositions0[dir], dir, pr1, defaultLinkPositions1[dir], linkAttributes);
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

function assertInteger(n:number, ctx:string) {
	if( n != Math.floor(n) ) throw new Error(ctx+" is not an integer!: "+n);
}

class Bitmap {
	protected _data:number[];
	protected _offsetX:number;
	protected _offsetY:number;
	protected _offsetZ:number;
	protected _width:number;
	protected _height:number;
	protected _depth:number;
	public constructor(protected bounds:AABB) {
		this._offsetX = bounds.minX;
		this._offsetY = bounds.minY;
		this._offsetZ = bounds.minZ;
		this._width  = bounds.maxX-bounds.minX;
		this._height = bounds.maxY-bounds.minY;
		this._depth  = bounds.maxZ-bounds.minZ;
		assertInteger(this._width , "bitmap width");
		assertInteger(this._height, "bitmap height");
		assertInteger(this._depth , "bitmap depth");
		console.log("Make one ", this._width*this._height*this._depth, this._width, this._height, this._depth);
		this._data = new Array<number>(this._width*this._height*this._depth);
	}
	
	public get width() { return this._width; }
	public get height() { return this._height; }
	public get depth() { return this._depth; }
	public get data() { return this._data; }
	
	public fill(x0:number, y0:number, z0:number, x1:number, y1:number, z1:number, v:number) {
		if( x0 < this._offsetX ) x0 = this._offsetX;
		if( y0 < this._offsetY ) y0 = this._offsetY;
		if( z0 < this._offsetZ ) z0 = this._offsetZ;
		const maxX = this._offsetX+this._width;
		const maxY = this._offsetY+this._height;
		const maxZ = this._offsetZ+this._depth;
		if( x1 > maxX ) x1 = maxX;
		if( y1 > maxY ) y1 = maxY;
		if( z1 > maxZ ) z1 = maxZ;
		
		x0 -= this._offsetX; y0 -= this._offsetY; z0 -= this._offsetZ;
		x1 -= this._offsetX; y1 -= this._offsetY; z1 -= this._offsetZ;
		for( let z=z0; z<z1; ++z ) {
			for( let y=y0; y<y1; ++y ) {
				for( let x=x0; x<x1; ++x ) {
					const i = x + y*(this._width) + z*(this._width*this._height);
					this._data[i] = v;
				}
			}
		}
	}
}

function randInt(min:number, max:number) {
	const m = Math.floor(max-min)+1;
	return min + Math.floor( m * Math.random() );
}

function rot2<T>( t:T[] ) {
	return [t[2],t[3],t[0],t[1]];
}

export default class GraphWorldifier {
	public constructor( protected _gdm:GameDataManager, protected _maze:Maze ) { }
	
	protected linkDirections:KeyedList<number> = {};
	protected protoRoomSpans:KeyedList<ProtoRoomSpan> = {};
	protected _tileEntityPaletteRef:string|undefined;
	
	public gardenChance = 0.125;
	public caveChance = 0.5;
	
	public get gameDataManager() { return this._gdm; }
	public get maze() { return this._maze; }
	
	public set tileEntityPaletteRef(t:string) {
		this._tileEntityPaletteRef = t;
	}
	public get tileEntityPaletteRef() {
		if( this._tileEntityPaletteRef == null ) throw new Error("No tile entity palette ref!");
		return this._tileEntityPaletteRef;
	}
	
	protected protoRooms:KeyedList<ProtoRoom> = {}
	protected newProtoRoom(spanId:string, bounds:AABB) {
		const pr = newProtoRoom(spanId, bounds);
		this.protoRooms[pr.id] = pr;
		return pr;
	}
	
	protected spareProtoRoomSpans:KeyedList<ProtoRoomSpan> = {};
	
	protected protoRoomSpanMeetsRequirements(prs:ProtoRoomSpan, reqs:RoomSpanRequirements):boolean {
		const openSides = [0,0,0,0];
		for( let pr in prs.protoRooms ) {
			for( let d=0; d<4; ++d ) if( prs.protoRooms[pr].protoLinks[d] == null ) ++openSides[d];
		}
		for( let d=0; d<4; ++d ) {
			if( reqs.exitsPerSide[d] > openSides[d] ) return false;
		}
		return true;
	}
	
	protected calculateNodeSpanRequirements( gn:MazeNode ):RoomSpanRequirements {
		const linkCounts = [0,0,0,0];
		// Count number of links that must point each direction
		for( let linkNumber=0; linkNumber<gn.linkIds.length; ++linkNumber ) {
			const linkId = gn.linkIds[linkNumber];
			const link = this._maze.links[linkId];
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
			const link = this._maze.links[linkId];
			const linkDir:number|undefined = this.linkDirections[linkId];
			if( linkDir == undefined ) {
				const isForward = (link.endpoint0.nodeId == gn.id && link.endpoint0.linkNumber == linkNumber);
				
				const linkCounts2 = isForward ? linkCounts : rot2(linkCounts);
				const linkDir = pickLinkDirection(linkCounts2, link);
				this.linkDirections[linkId] = linkDir;
				
				++linkCounts[isForward ? linkDir : oppositeDirection(linkDir)];
			}
		}
		
		const exitsPerSide = [0,0,0,0];
		for( let linkNumber=0; linkNumber<gn.linkIds.length; ++linkNumber ) {
			const linkId = gn.linkIds[linkNumber];
			const link = this._maze.links[linkId];
			const linkDir:number|undefined = this.linkDirections[linkId];
			if( linkDir == undefined ) throw new Error("linkDir should have been popualted");
			const isForward = (link.endpoint0.nodeId == gn.id && link.endpoint0.linkNumber == linkNumber);
			const dir = isForward ? linkDir : oppositeDirection(linkDir);
			++exitsPerSide[dir];
		}
		return { exitsPerSide };
	}
	
	protected generateBoringProtoRoomSpan(reqs:RoomSpanRequirements, node:MazeNode):ProtoRoomSpan {
		// Is this where 'generate nice room spans' code might go?
		// e.g. try generating a cavey room or something
		const spanId = newUuidRef();
		const spanProtoRooms:KeyedList<ProtoRoom> = {};
		const openSides = [1,1,1,1];
		const roomBounds = makeAabb(randInt(-4,-6),randInt(-4,-6),-0.5, randInt(4,6),randInt(4,6),+0.5);
		let protoRoom = this.newProtoRoom(spanId, roomBounds);
		spanProtoRooms[protoRoom.id] = protoRoom;
		for( let i=0; i<reqs.exitsPerSide.length; ++i ) {
			while( reqs.exitsPerSide[i] > openSides[i] ) {
				// We gotta dig in a perpendicular direction.
				let digDir = ((i+1) + randInt(0,1)*2) % 4;
				if( protoRoom.protoLinks[digDir] ) digDir = (digDir + 2) % 4;
				const newRoom = this.newProtoRoom(spanId, roomBounds);
				linkProtoRoomsDefaultly(protoRoom, digDir, newRoom, {
					isBidirectional: true,
					interSpan: false,
				});
				spanProtoRooms[newRoom.id] = newRoom;
				++openSides[i];
				++openSides[oppositeDirection(i)];
				protoRoom = newRoom;
			}
		}
		return { id: spanId, protoRooms: spanProtoRooms };
	}
	
	protected generateProtoRoomSpan(reqs:RoomSpanRequirements, node:MazeNode):ProtoRoomSpan {
		return this.generateBoringProtoRoomSpan(reqs, node);
	}
	
	protected getNewProtoRoomSpanForNode(node:MazeNode):ProtoRoomSpan {
		const reqs:RoomSpanRequirements = this.calculateNodeSpanRequirements(node);
		
		for( let i in this.spareProtoRoomSpans ) {
			if( this.protoRoomSpanMeetsRequirements(this.spareProtoRoomSpans[i], reqs) ) {
				const prs = this.spareProtoRoomSpans[i];
				delete this.spareProtoRoomSpans[i];
				prs.node = node;
				return prs;
			}
		}
		
		for( let i=0; i<10; ++i ) {
			const prs:ProtoRoomSpan = this.generateProtoRoomSpan(reqs, node);
			if( this.protoRoomSpanMeetsRequirements(prs, reqs) ) {
				prs.node = node;
				return prs;
			}
		}
		const prs = this.generateBoringProtoRoomSpan(reqs, node);
		prs.node = node;
		return prs;
	}
	
	protected generateLinkSpan(link:MazeLink, locks:KeySet):ProtoRoomSpan {
		const spanId = newUuidRef();
		const protoRooms:KeyedList<ProtoRoom> = {};
		const newRoom = this.newProtoRoom(spanId, makeAabb(-4,-4,-0.5,+4,+4,+0.5));
		newRoom.doors = locks;
		protoRooms[newRoom.id] = newRoom;
		return { id: spanId, protoRooms };
	}
	
	protected findRoomWithOpenWall(span:ProtoRoomSpan, direction:number, spanId:string):ProtoRoom {
		let roomCount = 0;
		for( let r in span.protoRooms ) {
			const room = span.protoRooms[r];
			if( room.protoLinks[direction] == null ) return room;
			++roomCount;
		}
		console.error("Span "+spanId+": "+JSON.stringify(span,null,"\t"));
		throw new Error("No open "+direction+" wall in span "+spanId+"; size="+roomCount);
	}
	
	protected connectSpans(span0Id:string, dir:number, span1Id:string, isBidirectional:boolean):void {
		const span0 = this.protoRoomSpans[span0Id];
		const span1 = this.protoRoomSpans[span1Id];
		const rid = oppositeDirection(dir);
		const room0 = this.findRoomWithOpenWall(span0, dir, span0Id);
		const room1 = this.findRoomWithOpenWall(span1, rid, span1Id);
		const linkAttributes = { isBidirectional, interSpan: true }
		linkProtoRoomsDefaultly( room0, dir, room1, linkAttributes );
	}
	
	protected primaryWallTileIndex(node:MazeNode|undefined):number {
		if( node ) {
			if( node.items[ITEMCLASS_START] ) return 14;
			else if( node.items[ITEMCLASS_END] ) return 1;
			else if( node.requiredKeys[ITEMCLASS_REDKEY] ) return 20;
			else if( node.requiredKeys[ITEMCLASS_YELLOWKEY] ) return 19;
			else if( node.requiredKeys[ITEMCLASS_BLUEKEY] ) return 15;
		}
		return 21;
	}
	
	protected protoLinkedWallTileIndex(link:ProtoRoomLink|undefined) {
		if( !link ) return 21;
		
		const protoRoom = this.protoRooms[link.neighborRef];
		if( !protoRoom ) return 21;
		const span = this.protoRoomSpans[protoRoom.protoRoomSpanRef];
		if( !span || !span.node ) return 21;
		return this.primaryWallTileIndex(span.node);
	}
	
	protected protoRoomSpanToWorldRooms(span:ProtoRoomSpan):void {
		let itemsPlaced = false;
		for( let pr in span.protoRooms ) {
			const protoRoom = span.protoRooms[pr];
			// TODO: Make more interesting rooms, maybe with the help of generateSpan
			// have it figure general size and shape so we know how to place neighbors ahead of time
			//const roomWidth = 8, roomHeight = 8, roomDepth = 1;
			//const roomBounds:AABB = makeAabb(-roomWidth/2, -roomHeight/2, -roomDepth/2, roomWidth/2, roomHeight/2, roomDepth/2);
			const roomBounds = protoRoom.bounds;
			const roomWidth = roomBounds.maxX-roomBounds.minX;
			const tileBmp = new Bitmap(roomBounds);
			const wallTileIndex = this.primaryWallTileIndex(span.node);
			const primaryFloorHeight = roomBounds.maxY - 3;
			let ceilingHeight = span.node ? randInt(roomBounds.minX+1,primaryFloorHeight-2) : primaryFloorHeight-2;
			const neighbors:KeyedList<RoomNeighbor> = {};
			const ladderTileIndex = 5;
			const rockTileIndex = 29;

			const rightProtoLink = protoRoom.protoLinks[DIR_RIGHT];
			const leftProtoLink = protoRoom.protoLinks[DIR_LEFT];
			const topProtoLink = protoRoom.protoLinks[DIR_UP];
			const bottomProtoLink = protoRoom.protoLinks[DIR_DOWN];
			
			if( bottomProtoLink && !bottomProtoLink.attributes.isBidirectional ) {
				// Make sure they have room to jump over
				ceilingHeight = Math.min(primaryFloorHeight-3, ceilingHeight);
			}
			
			const platformTileIndex = 2;
			
			let hasDoors = false;
			for( let k in protoRoom.doors ) hasDoors = true;
			
			let floorHeights:number[]|undefined = protoRoom.floorHeights;
			if( floorHeights == undefined ) {
				floorHeights = [];
				for( let i=0; i<tileBmp.width; ++i ) floorHeights[i] = primaryFloorHeight;
			}
			const rightFloorHeight = Math.round(floorHeights[floorHeights.length-1]);
			const leftFloorHeight = Math.round(floorHeights[0]);
			
			const z0 = roomBounds.minZ, z1 = roomBounds.maxZ;
			let hasGarden, fancyLadders;
			let leftWallX, rightWallX;
			if( protoRoom.styleId == 'cave' ) {
				console.log("Cave room! ", floorHeights);
				tileBmp.fill(roomBounds.minX  ,roomBounds.minY,z0, roomBounds.maxX  ,   roomBounds.maxY,z1, rockTileIndex);
				let ceilingHeights:number[] = protoRoom.ceilingHeights;
				if( ceilingHeights == undefined ) throw new Error("Cave doesn't have ceiling heights arg!");
				for( let i=0; i<floorHeights.length; ++i ) {
					const x = roomBounds.minX+i;
					const floorHeight = Math.round(floorHeights[i]);
					tileBmp.fill(x,Math.round(ceilingHeights[i]),z0, x+1,floorHeight,z0, 0);
					// todo add vines, etc
					
					let minNeighboringFloorHeight = floorHeights[i];
					if( i>0 ) minNeighboringFloorHeight = Math.min(floorHeights[i-1], minNeighboringFloorHeight);
					if( i<roomWidth-1 ) minNeighboringFloorHeight = Math.min(floorHeights[i+1], minNeighboringFloorHeight);
					minNeighboringFloorHeight = Math.round(minNeighboringFloorHeight);
					const needLadder = floorHeight-minNeighboringFloorHeight > 2;
					tileBmp.fill(x,minNeighboringFloorHeight-1,z0, x+1,floorHeight,z1, needLadder?ladderTileIndex:0);
				}
				if( protoRoom.protoLinks[DIR_RIGHT] == undefined ) {
					tileBmp.fill(roomBounds.maxX-1,roomBounds.minY,z0, roomBounds.maxX,roomBounds.maxY,z1, wallTileIndex);
				}
				if( protoRoom.protoLinks[DIR_LEFT] == undefined ) {
					tileBmp.fill(roomBounds.minX,roomBounds.minY,z0, roomBounds.minX+1,roomBounds.maxY,z1, wallTileIndex);
				}
				if( protoRoom.protoLinks[DIR_DOWN] == undefined ) {
					tileBmp.fill(roomBounds.minX,roomBounds.maxY-1,z0, roomBounds.maxX,roomBounds.maxY,z1, wallTileIndex);
				}
				if( protoRoom.protoLinks[DIR_UP] == undefined ) {
					tileBmp.fill(roomBounds.minX,roomBounds.minY,z0, roomBounds.maxX,roomBounds.minY+1,z1, wallTileIndex);
				}
				hasGarden = false;
				leftWallX  = roomBounds.minX+1;
				rightWallX = roomBounds.maxX-1;
				fancyLadders = false;
			} else {
				leftWallX  = roomBounds.minX+2;
				rightWallX = roomBounds.maxX-2;
				tileBmp.fill(roomBounds.minX  ,roomBounds.minY,z0, roomBounds.maxX  ,   roomBounds.maxY,z1, wallTileIndex);
				tileBmp.fill(leftWallX,  ceilingHeight,z0, rightWallX,primaryFloorHeight,z1, 0);
				hasGarden = Math.random() < this.gardenChance;
				fancyLadders = true;
			}
			
			if( rightProtoLink ) {
				const hallWidth = rightProtoLink.attributes.interSpan ? 2 : 4;
				tileBmp.fill(rightWallX, Math.max(roomBounds.minY+1,rightFloorHeight-hallWidth),z0, roomBounds.maxX,Math.min(roomBounds.maxY-1,rightFloorHeight),z1, 0);
			}
			if( leftProtoLink ) {
				const hallWidth = leftProtoLink.attributes.interSpan ? 2 : 4;
				tileBmp.fill(roomBounds.minX, Math.max(roomBounds.minY+1,leftFloorHeight-hallWidth),z0, leftWallX,Math.min(roomBounds.maxY-1,leftFloorHeight),z1, 0);
			}
			
			if( hasGarden ) {
				// Garden!
				tileBmp.fill( roomBounds.minX+1,primaryFloorHeight,z0, roomBounds.maxX-1,roomBounds.maxY,z1, 0 );
				//tileBmp.fill( 1,floorHeight+1,0, roomWidth-1,floorHeight+2,1, rockTileIndex ); // rocks!
				const hilliness = Math.random();
				let groundHeight = primaryFloorHeight+Math.random()*(primaryFloorHeight+roomBounds.maxY-1);
				for(let x=roomBounds.minX+1; x<roomBounds.maxX-1; ++x ) {
					groundHeight += (Math.random()-0.5)*2*hilliness;
					const minGroundHeight = (x < roomBounds.minX+3 || x >= roomBounds.maxX-3) ? primaryFloorHeight-1 : ceilingHeight+1;
					if( groundHeight < minGroundHeight ) groundHeight = minGroundHeight;
					if( groundHeight > roomBounds.maxY-1 ) groundHeight = roomBounds.maxY-1;
					const groundHeightAbs = Math.round(groundHeight);
					floorHeights[x-roomBounds.minX] = groundHeightAbs;
					tileBmp.fill(x,groundHeightAbs,z0, x+1,roomBounds.maxY,z1, rockTileIndex);
					if( Math.random() < 0.5 ) {
						let plantTileIndex:number;
						if( Math.random() < 0.125 ) plantTileIndex = 14; // brown brick
						else plantTileIndex = [26,25,3][Math.floor(Math.random()*Math.random()*3)];
						tileBmp.fill(x,groundHeightAbs-1,z0, x+1,groundHeightAbs,z1, plantTileIndex);
					}
				}
			}
			
			if( topProtoLink ) {
				if( hasDoors ) throw new Error("Lock room has vertical link!");
				const linkX = topProtoLink.position.x;
				if( fancyLadders ) {
					const hallWidth = topProtoLink.attributes.interSpan ? 2 : 4;
					const hhw = hallWidth/2;
					tileBmp.fill(linkX-hhw,roomBounds.minY, z0, linkX+hhw,primaryFloorHeight,z1, 0);
					if( topProtoLink.attributes.isBidirectional ) {
						tileBmp.fill(linkX,roomBounds.minY,z0, linkX+1,floorHeights[linkX-roomBounds.minX]-1,z1, ladderTileIndex);
					}
				} else {
					if( topProtoLink.attributes.isBidirectional ) {
						tileBmp.fill(linkX,roomBounds.minY,z0, linkX+1,Math.floor(floorHeights[linkX])-1,z1, ladderTileIndex);
					} else {
						tileBmp.fill(linkX,roomBounds.minY,z0, linkX+1,Math.floor(floorHeights[linkX])-1,z1, 0);
					}
				}
			}
			if( bottomProtoLink ) {
				if( hasDoors ) throw new Error("Lock room has vertical link!");
				const linkX = bottomProtoLink.position.x;
				if( fancyLadders ) {
					const hallWidth = bottomProtoLink.attributes.interSpan ? 2 : 4;
					const hhw = hallWidth/2;
					if( bottomProtoLink.attributes.isBidirectional ) {
						if( Math.random() < 0.5 ) {
							tileBmp.fill(linkX-1, primaryFloorHeight, z0, linkX+2, primaryFloorHeight+1, z1, platformTileIndex);
						} else {
							tileBmp.fill(roomBounds.minX, primaryFloorHeight, z0, roomBounds.maxX, primaryFloorHeight+1, z1, platformTileIndex);
						}
						const ladderX = linkX;
						tileBmp.fill(ladderX,primaryFloorHeight-1,z0, ladderX+1,roomBounds.maxY,z1, ladderTileIndex)
					} else {
						tileBmp.fill(linkX-hhw, primaryFloorHeight, z0, linkX+hhw, roomBounds.maxY, z1, 0);
					}
				} else {
					if( bottomProtoLink.attributes.isBidirectional ) {
						tileBmp.fill(linkX,Math.floor(floorHeights[linkX])-1,z0, linkX+1,roomBounds.maxY,z1, ladderTileIndex);
					} else {
						tileBmp.fill(linkX,Math.floor(floorHeights[linkX]),z0, linkX+1,roomBounds.maxY,z1, 0);
					}
				}
			}
			
			for( let i=0; i<4; ++i ) {
				const protoLink = protoRoom.protoLinks[i];
				if( protoLink ) {
					const neighborProtoRoom = this.protoRooms[protoLink.neighborRef];
					const neighborLink = neighborProtoRoom.protoLinks[(i+2)%4];
					if( !neighborLink ) throw new Error("Complementary link missing!!");
					const neighborLinkPosition = neighborLink.position;
					neighbors["n"+i] = {
						bounds: roomBounds,
						roomRef: protoLink.neighborRef,
						offset: subtractVector(protoLink.position, neighborLinkPosition)
					}
				}
			}
			
			if( hasDoors ) {
				const leftWallTileIndex = this.protoLinkedWallTileIndex(protoRoom.protoLinks[DIR_LEFT]);
				const rightWallTileIndex = this.protoLinkedWallTileIndex(protoRoom.protoLinks[DIR_RIGHT]);
				
				let doorPos = roomBounds.minX+2;
				let lastDoorPos = doorPos;
				tileBmp.fill(roomBounds.minX,roomBounds.minY,z0, doorPos,ceilingHeight,z1, leftWallTileIndex);
				tileBmp.fill(roomBounds.minX,primaryFloorHeight,z0, doorPos,roomBounds.maxY,z1, leftWallTileIndex);
				for( let k in protoRoom.doors ) {
					let doorTileIndex:number;
					let doorFrameTileIndex:number;
					switch( k ) {
					case ITEMCLASS_BLUEKEY:
						doorTileIndex = 16;
						doorFrameTileIndex = 22;
						break;
					case ITEMCLASS_YELLOWKEY:
						doorTileIndex = 17;
						doorFrameTileIndex = 23;
						break;
					case ITEMCLASS_REDKEY:
						doorTileIndex = 18;
						doorFrameTileIndex = 24;
						break;
					default: throw new Error("No door tile index known for "+k);
					}
					tileBmp.fill(doorPos,roomBounds.minY,z0, doorPos+1,roomBounds.maxY,z1, doorFrameTileIndex);
					tileBmp.fill(doorPos,ceilingHeight,z0, doorPos+1, primaryFloorHeight,z1, doorTileIndex);
					lastDoorPos = doorPos;
					doorPos += 2;
				}
				tileBmp.fill(lastDoorPos+1,roomBounds.minX,z0, roomBounds.maxX,ceilingHeight,z1, rightWallTileIndex);
				tileBmp.fill(lastDoorPos+1,primaryFloorHeight,z0, roomBounds.maxX,roomBounds.maxY,z1, rightWallTileIndex);
			}
			
			const roomEntities:KeyedList<RoomEntity> = {}
			
			const itemX = !protoRoom.protoLinks[DIR_DOWN] ? 0.5 :
				!protoRoom.protoLinks[DIR_LEFT] ? -1.5 :
				!protoRoom.protoLinks[DIR_RIGHT] ? +1.5 :
				-0.5;
			let itemY = floorHeights[Math.floor(itemX-roomBounds.minX)] - 1.5;
			if( span.node && !itemsPlaced ) placeItems: for( let k in span.node.items ) {
				const itemClassId = span.node.items[k];
				let entityClassRef:string;
				switch( itemClassId ) {
				case ITEMCLASS_BLUEKEY  : entityClassRef = dat.blueKeyEntityClassId; break;
				case ITEMCLASS_YELLOWKEY: entityClassRef = dat.yellowKeyEntityClassId; break;
				case ITEMCLASS_REDKEY   : entityClassRef = dat.redKeyEntityClassId; break;
				case ITEMCLASS_START    : continue placeItems;
				case ITEMCLASS_END      : entityClassRef = dat.triforceEntityClassId; break;
				default: throw new Error("Unknown entity type "+itemClassId);
				}
				
				const tileX = Math.floor(itemX);
				const tileY = Math.floor(itemY);
				if( !itemsPlaced ) {
					tileBmp.fill(tileX,tileY+1,z0, tileX+1,tileY+2,z1, platformTileIndex);
				}
				
				// Make sure there's space around to get the thing!
				tileBmp.fill(tileX,tileY,z0, tileX+1,tileY+1,z1, 0);
				tileBmp.fill(tileX-1,tileY,z0, tileX,tileY+2,z1, 0);
				tileBmp.fill(tileX+1,tileY,z0, tileX+2,tileY+2,z1, 0);
				roomEntities[newUuidRef()] = {
					position: {x: itemX, y: itemY, z:0},
					entity: { classRef: entityClassRef }
				}
				--itemY;
				itemsPlaced = true;
			}
			
			roomEntities[newUuidRef()] = {
				position: ZERO_VECTOR,
				entity: { classRef: makeTileTreeRef(this.tileEntityPaletteRef, tileBmp.width, tileBmp.height, tileBmp.depth, tileBmp.data, this._gdm, {
					infiniteMass: true, boundingBox: roomBounds
				}) }
			};
			const room:Room = {
				bounds: roomBounds,
				roomEntities,
				neighbors
			}
			this._gdm.tempStoreObject<Room>( room, protoRoom.id );
		}
	}
	
	public run() {
		let startNodeId = '0';
		const nodeProtoRoomSpans:KeyedList<ProtoRoomSpan> = {}
		for( let n in this._maze.nodes ) {
			const node = this._maze.nodes[n];
			const protoRoomSpan = this.getNewProtoRoomSpanForNode(node);
			this.protoRoomSpans[protoRoomSpan.id] = protoRoomSpan;
			nodeProtoRoomSpans[n] = protoRoomSpan;
			if( node.items[ITEMCLASS_START] ) startNodeId = n;
		}
		
		for( let linkId in this._maze.links ) {
			const link = this._maze.links[linkId];
			const linkDir = this.linkDirections[linkId];
			if( linkDir == undefined ) {
				throw new Error("Link "+linkId+" has no direction");
			}
			
			let needsOwnRoom = false;
			for( let k in link.locks ) needsOwnRoom = true;
			
			const span0Id = nodeProtoRoomSpans[link.endpoint0.nodeId].id;
			const span1Id = nodeProtoRoomSpans[link.endpoint1.nodeId].id;
			let span2Id:string, span3Id:string;
			if( needsOwnRoom ) {
				const linkSpan = this.generateLinkSpan(link, link.locks);
				this.protoRoomSpans[linkSpan.id] = linkSpan;
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
		
		const span0 = nodeProtoRoomSpans[startNodeId];
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

export function mazeToWorld(worldifier:GraphWorldifier):Promise<{ gdm:GameDataManager, playerId:string, startRoomRef:string }> {
	const gdm = worldifier.gameDataManager;
	return dat.initData(gdm).then(() => gdm.fetchTranslation( dat.tileEntityPaletteId )).then( (tepRef) => {
		//const worldifier:GraphWorldifier = new GraphWorldifier(gdm, maze);
		worldifier.tileEntityPaletteRef = tepRef;
		return worldifier;
	}).then( (worldifier) => {
		const startRoomRef = worldifier.run();
		const startRoom = gdm.getMutableRoom(startRoomRef)
		startRoom.roomEntities[dat.playerEntityId] = {
			position: {x:0,y:0.5,z:0},
			entity: {
				id: dat.playerEntityId,
				classRef: dat.playerEntityClassId,
				desiresMaze1AutoActivation: true,
			}
		}
		
		return { gdm, playerId:dat.playerEntityId, startRoomRef };
	})
}

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
	const gdm = new GameDataManager(ds);
	readStream(process.stdin).then( (parts) => {
		const maze:Maze = JSON.parse(parts.join(""));
		const worldifier = new GraphWorldifier(gdm, maze);
		return mazeToWorld(worldifier);
	}).then( ({gdm, playerId, startRoomRef}) => {
		gdm.flushUpdates().then( (rootNodeUri) => {
			if( gdm.getObjectIfLoaded(startRoomRef) == undefined ) {
				throw new Error("Failed to find start room in "+rootNodeUri);
			}
			const sg:SaveGame = {
				gameDataRef: rootNodeUri,
				playerId: dat.playerEntityId,
				rootRoomId: startRoomRef,
			};
			return gdm.storeObject(sg);
		}).then( (saveRef) => {
			console.log(saveRef);
		});
	}).catch( (err) => {
		console.error("Error! ", err);
		process.exit(1);
	});
}
