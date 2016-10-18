/// <reference path="../Promise.d.ts"/>
/// <reference path="../node.d.ts"/>

interface MazeGraphNode {
	id : number;
	// east, south, west, north neighbors
	neighborIds : (number|undefined)[];
	ladderUp : boolean;
	ladderDown : boolean;
	distanceFromStart : number;
	isStartRoom : boolean;
	isEndRoom : boolean;
	roomRef? : string;
}

type MazeLinkDirection = number;

interface MazeGraph {
	solution : MazePath;
	nodes : MazeGraphNode[]
};

// Algorithm!
// - Make a random path from start to end; print path for proof
// - Add branches
// - Add loops to nodes with similar distanceFromStart
// - Add drops to nodes with < distanceFromStart

function blankMazeNode(id:number):MazeGraphNode {
	return {
		id: id,
		neighborIds: [undefined, undefined, undefined, undefined],
		ladderUp: false,
		ladderDown: false,
		distanceFromStart: 0,
		isStartRoom: false,
		isEndRoom: false
	};
}

function directionToString(dir:number):string {
	switch( dir ) {
	case 0: return 'r';
	case 1: return 'd';
	case 2: return 'l';
	case 3: return 'u';
	}
	throw new Error("Invalid direction "+dir);
}

function oppositeDirection(dir:number):number {
	return (dir + 2) % 4;
}

function pickLinkDirection(node0:MazeGraphNode, node1:MazeGraphNode):number|undefined {
	const rs = Math.floor(Math.random()*4);
	for( let i=0; i<4; ++i ) {
		const dir0 = (i + rs) % 4;
		const dir1 = oppositeDirection(dir0);
		if( node0.neighborIds[dir0] == undefined && node1.neighborIds[dir1] == undefined ) return dir0;
	}
	return undefined;
}

interface MazePath {
	startNodeId : number;
	endNodeId : number;
	directions : number[];
}

function connectNodes(node0:MazeGraphNode, dir0:number, node1:MazeGraphNode, bidirectional:boolean):void {
	if( !bidirectional && dir0 != 1 ) {
		throw new Error("Unidirectional links can only be downwards (direction = 1)");
	}
	
	const dir1 = oppositeDirection(dir0);
	if( node0.neighborIds[dir0] ) throw new Error("Node "+node0.id+" already connected in direction "+dir0+"!");
	if( node1.neighborIds[dir1] ) throw new Error("Node "+node1.id+" already connected in direction "+dir1+"!");
	node0.neighborIds[dir0] = node1.id;
	node1.neighborIds[dir1] = node0.id;
	if( bidirectional ) {
		if( dir0 == 1 ) {
			node0.ladderDown = true;
			node1.ladderUp = true;
		} else if( dir0 == 3 ) {
			node0.ladderUp = true;
			node1.ladderDown = true;
		}
	}
}

function generatePrimaryPath(nodes:MazeGraphNode[], startNodeId:number, len:number):MazePath {
	let curNodeId = startNodeId;
	const path:MazePath = {
		startNodeId: startNodeId,
		endNodeId: curNodeId,
		directions: [],
	};
	while( len > 0 ) {
		const curNode = nodes[curNodeId];
		const newNodeId = nodes.length;
		const newNode = blankMazeNode(newNodeId);
		nodes.push(newNode);
		const dir = pickLinkDirection(curNode, newNode);
		if( dir == undefined ) throw new Error("Failed to pick direction to next maze node");
		connectNodes(curNode, dir, newNode, true);
		path.directions.push(dir);
		curNodeId = newNodeId;
		--len;
	}
	path.endNodeId = curNodeId;
	return path;
}

function generateMazeGraph(pathLength:number, maxRoomCount:number):Promise<MazeGraph> {
	const nodes:MazeGraphNode[] = [];
	nodes.push(blankMazeNode(0));
	nodes[0].isStartRoom = true;
	const solution = generatePrimaryPath( nodes, 0, pathLength );
	nodes[solution.endNodeId].isEndRoom = true;
	return Promise.resolve({
		solution: solution,
		nodes: nodes,
	});
}

import KeyedList from './KeyedList';
import Vector3D from './Vector3D';
import AABB from './AABB';
import {
	makeAabb
} from './aabbs';
import GameDataManager from './GameDataManager';
import {
	Room, RoomNeighbor
} from './world';
import {
	connectRooms,
	makeTileTreeRef,
	roomNeighborKey,
} from './worldutil';
import {
	newType4Uuid,
	uuidUrn,
} from '../tshash/uuids';
import * as dat from './maze1demodata';
import {
	basicTileEntityPaletteRef,
} from './maze1demodata';

function fill(tileIndexes:number[], x0:number, y0:number, x1:number, y1:number, tileIndex:number):void {
	for( let y=y0; y<y1; ++y ) {
		for( let x=x0; x<x1; ++x ) {
			tileIndexes[8*y+x] = tileIndex;
		}
	}
}

function randInt(min:number, max:number) {
	const m = Math.floor(max-min)+1;
	return min + Math.floor( m * Math.random() );
}

function nodeTileIndexes(mgn:MazeGraphNode):number[] {
	let tileIndexes:number[] = [];
	for( let i=0; i<64; ++i ) tileIndexes[i] = 1;
	
	const ceilingY   = randInt(1,4);
	const leftWallX  = randInt(1,4);
	const rightWallX = randInt(4,7);
	
	fill( tileIndexes, leftWallX,ceilingY, rightWallX,5, 0);
	
	const floorLeftX  = Math.min(leftWallX, mgn.neighborIds[2] ? 0 : 3);
	const floorRightX = Math.max(rightWallX, mgn.neighborIds[0] ? 8 : 5);
	fill( tileIndexes, floorLeftX,5, floorRightX,6, 2);
	
	if( mgn.neighborIds[0] != undefined ) fill(tileIndexes, 3,3, 8,5, 0);
	if( mgn.neighborIds[1] != undefined ) fill(tileIndexes, 3,3, 5,8, 0);
	if( mgn.neighborIds[2] != undefined ) fill(tileIndexes, 0,3, 5,5, 0);
	if( mgn.neighborIds[3] != undefined ) fill(tileIndexes, 3,0, 5,5, 0);
	if( mgn.ladderDown ) {
		fill(tileIndexes, 3,5, 4,6, 2);
		fill(tileIndexes, 4,4, 5,8, 5);
	}
	if( mgn.ladderUp ) {
		fill(tileIndexes, 4,0, 5,4, 5);
	}
	
	return tileIndexes;
}

function newUuidRef():string { return uuidUrn(newType4Uuid()); }

/**
 * Store generated rooms in gdm,
 * the MazeGraph will be modified in-place such that
 * nodes all have a roomRef and returned.
 */
function mazeToRooms(mg:MazeGraph, gdm:GameDataManager):Promise<MazeGraph> {
	const roomBounds:AABB = makeAabb(-4,-4,-4, 4,4,4);
	for( let n in mg.nodes ) {
		const mgn = mg.nodes[n];
		mgn.roomRef = newUuidRef();
	}
	for( let o in mg.nodes ) {
		const mgn = mg.nodes[o];
		if( mgn.roomRef == undefined ) throw new Error("Ung how did happen");
		const tileIndexes = nodeTileIndexes(mgn);
		const ttClassRef = makeTileTreeRef(
			basicTileEntityPaletteRef,
			8, 8, 1, tileIndexes, gdm,
			{ infiniteMass: true }
		);
		let neighbors:KeyedList<RoomNeighbor> = {};
		for( let n=0; n<4; ++n ) {
			const nnId = mgn.neighborIds[n];
			if( nnId != undefined ) {
				let nOffset:Vector3D;
				switch( n ) {
				case 0: nOffset = {x:+8, y:  0, z:0}; break;
				case 1: nOffset = {x: 0, y:+8, z:0}; break;
				case 2: nOffset = {x:-8, y:  0, z:0}; break;
				case 3: nOffset = {x: 0, y:-8, z:0}; break;
				default: throw new Error("Unknown offset for direction "+n);
				}
				const nn = mg.nodes[nnId];
				if( nn == undefined ) throw new Error("Oh no, node "+nnId+" ("+o+" neighbor "+n+") not exist");
				const nRoomRef = nn.roomRef;
				if( nRoomRef == undefined ) throw new Error("Oh no, node "+nnId+" has no roomRef");
				const nK = roomNeighborKey(mgn.roomRef, nOffset, nRoomRef);
				neighbors[nK] = {
					offset: nOffset,
					bounds: roomBounds,
					roomRef: nRoomRef
				}
			}
		}
		gdm.tempStoreObject<Room>( {
			bounds: roomBounds,
			neighbors: neighbors,
			roomEntities: {
				[newUuidRef()]: {
					position: {x:0,y:0,z:0},
					entity: { classRef: ttClassRef },
				}
			}
		}, mgn.roomRef);
	}
	
	return Promise.resolve(mg);
}

import { sha1Urn } from '../tshash/index';
import Datastore from './Datastore';
import HTTPHashDatastore from './HTTPHashDatastore';
import { SaveGame } from './Maze1';

if( typeof require != 'undefined' && typeof module != 'undefined' && require.main === module ) {
	const dataIdent = sha1Urn;
	const ds:Datastore<Uint8Array> = HTTPHashDatastore.createDefault();
	const gdm:GameDataManager = new GameDataManager(ds);
	
	const addPlayer = true;
	const saveGame = true;
	
	console.log("Generating maze graph...");
	
	generateMazeGraph( 8, 12 ).then( (mg) => Promise.all([
		dat.initData(gdm),
		gdm.fetchObject(basicTileEntityPaletteRef)
	]).then( () => mg )).then( (mg) => {
		return mazeToRooms(mg, gdm);
	}).then( (mg) => {
		if( addPlayer ) {
			const rootRoomId = mg.nodes[0].roomRef;
			if( !rootRoomId ) return Promise.reject(new Error("Oh no, no rootRoomId (when adding player)"));
			const room = gdm.getMutableRoom(rootRoomId);
			room.roomEntities[dat.playerEntityId] = {
				position: {x:0,y:0,z:0},
				entity: {
					id: dat.playerEntityId,
					classRef: dat.playerEntityClassId
				}
			}
		}
		return mg;
	}).then( (mg) => {
		const dirStrs:string[] = mg.solution.directions.map(directionToString);
		console.log("Solution from "+mg.solution.startNodeId+" to " +mg.solution.endNodeId+": "+dirStrs.join(","));
		console.log("Root room ref: "+mg.nodes[0].roomRef);
		for( let i=0; i<mg.nodes.length; ++i ) {
			if( mg.nodes[i].isStartRoom ) console.log("Start room: "+mg.nodes[i].roomRef);
			if( mg.nodes[i].isEndRoom ) console.log("End room: "+mg.nodes[i].roomRef);
		}
		return mg;
	}).then( (mg) => {
		if( saveGame ) return gdm.flushUpdates().then( (gameDataRef) => {
				const rootRoomId = mg.nodes[0].roomRef;
				if( !rootRoomId ) return Promise.reject(new Error("Oh no, no rootRoomId (when saving)"));
				return gdm.storeObject<SaveGame>( {
					gameDataRef,
					playerId: dat.playerEntityId,
					rootRoomId,
				});
			}).then( (saveRef) => {
				console.log("Saved game as "+saveRef);
				return mg;
			});
		return Promise.resolve(mg);
	}).catch( (err) => {
		console.error("Failed to generate maze!", err);
		process.exit(1);
	})
}
