/// <reference path="../../Promise.d.ts"/>
/// <reference path="../../node.d.ts"/>

import {
	blueKeyEntityClassId,
	yellowKeyEntityClassId,
	redKeyEntityClassId,
	cheapBlueDoorEntityClassId,
	cheapYellowDoorEntityClassId,
	cheapRedDoorEntityClassId,
	keyClassRefs,
	keyDoorClassRefs,
} from '../maze1demodata';

interface MazeGraphNode {
	id : number;
	// east, south, west, north neighbors
	neighborIds : (number|undefined)[];
	ladderUp : boolean;
	ladderDown : boolean;
	isStartRoom : boolean;
	isEndRoom : boolean;
	keysRequired : KeyedList<boolean>; // Key class => true
	distanceFromEnd? : number;
	roomRef? : string;
	items : KeyedList<string>; // Arbitray item key => class ref
}

type MazeLinkDirection = number;

interface MazeGraph {
	//solution : MazePath;
	nodes : MazeGraphNode[]
	startNodeId : number;
	endNodeId : number;
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
		items: {},
		keysRequired: {},
		ladderUp: false,
		ladderDown: false,
		isStartRoom: false,
		isEndRoom: false
	};
}

function newMazeNode(nodes:MazeGraphNode[], template?:MazeGraphNode):MazeGraphNode {
	const newNode = blankMazeNode(nodes.length);
	if( template ) newNode.keysRequired = template.keysRequired;
	nodes.push(newNode);
	return newNode;
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

const EVERYTHING_FITS = (t:any)=>1;

function pickLinkDirection(
	node0:MazeGraphNode, node1?:MazeGraphNode,
	fitnessFunction?:(dir:number)=>number
):number {
	if( !fitnessFunction ) {
		if( node1 && !isSameSet(node0.keysRequired, node1.keysRequired) ) {
			fitnessFunction = dir => directionIsHorizontal(dir) ? 1 : 0;
		} else {
			fitnessFunction = EVERYTHING_FITS;
		}
	}
	const rs = Math.floor(Math.random()*4);
	for( let i=0; i<4; ++i ) {
		const dir0 = (i + rs) % 4;
		if( fitnessFunction(dir0) <= 0 ) continue;
		if( node0.neighborIds[dir0] == undefined ) {
			if( node1 == undefined ) return dir0;
			const dir1 = oppositeDirection(dir0);
			if( node1.neighborIds[dir1] == undefined ) return dir0;
		}
	}
	if( node1 ) throw new Error("No matching free sides between nodes "+node0.id+" and "+node1.id);
	throw new Error("No free side on nodes "+node0.id);
}

interface MazePath {
	startNodeId : number;
	endNodeId : number;
	directions : number[];
}

const DIR_RIGHT = 0;
const DIR_DOWN  = 1;
const DIR_LEFT  = 2;
const DIR_UP    = 3;

function directionIsVertical( dir:number ):boolean {
	return (dir == DIR_DOWN) || (dir == DIR_UP);
}

function directionIsHorizontal( dir:number ):boolean {
	return (dir == DIR_RIGHT) || (dir == DIR_LEFT);
}

/**
 * Connects nodes.
 * 
 * By default a random direction is picked, unless bidirectional = false,
 * in which case the direction must be downwards.
 * 
 * By default, vertical links are made without ladders.
 */
function connectNodes(node0:MazeGraphNode, dir0:number|undefined, node1:MazeGraphNode, bidirectional:boolean|undefined):void {
	if( dir0 == undefined ) {
		const allowVertical = isSameSet(node0.keysRequired, node1.keysRequired);
		const dirFitness = (dir:number) => {
			if( !allowVertical && directionIsVertical(dir) ) return 0;
			if( bidirectional == false && dir != DIR_DOWN ) return 0;
			return 1;
		}; 
		dir0 = pickLinkDirection(node0, node1, dirFitness);
	}
	
	if( bidirectional == undefined ) bidirectional = directionIsHorizontal(dir0);
	
	if( !bidirectional && dir0 != DIR_DOWN ) {
		throw new Error("Unidirectional links can only be downwards");
	}
	
	const dir1 = oppositeDirection(dir0);
	if( node0.neighborIds[dir0] ) throw new Error("Node "+node0.id+" already connected in direction "+dir0+"!");
	if( node1.neighborIds[dir1] ) throw new Error("Node "+node1.id+" already connected in direction "+dir1+"!");
	node0.neighborIds[dir0] = node1.id;
	node1.neighborIds[dir1] = node0.id;
	if( bidirectional ) {
		if( dir0 == DIR_DOWN ) {
			node0.ladderDown = true;
			node1.ladderUp = true;
		} else if( dir1 == DIR_DOWN ) {
			node0.ladderUp = true;
			node1.ladderDown = true;
		}
	}
}

function nodesConnectable( node0:MazeGraphNode, node1:MazeGraphNode, directionFitness:(dir:number)=>number=EVERYTHING_FITS ):boolean {
	for( let i=0; i<4; ++i ) {
		if( directionFitness(i) <= 0 ) continue;
		if( node0.neighborIds[i] != undefined ) continue;
		const o = oppositeDirection(i); 
		if( node1.neighborIds[o] != undefined ) continue;
		return true;
	}
	return false;
}

interface MazeGenerationOptions {
	primaryPathLength : number;
	maxRoomCount : number;
	allowOneWaysInPrimaryPath : boolean;
	requiredKeyCount : number;
}

function generatePrimaryPath(nodes:MazeGraphNode[], startNodeId:number, opts:MazeGenerationOptions, additionallyRequiredKeys:KeyedList<boolean>={}):MazePath {
	let len = opts.primaryPathLength;
	let curNodeId = startNodeId;
	const path:MazePath = {
		startNodeId: startNodeId,
		endNodeId: curNodeId,
		directions: [],
	};
	while( len > 0 ) {
		const curNode = nodes[curNodeId];
		const newNodeId = nodes.length;
		const newNode = newMazeNode(nodes, curNode);
		newNode.keysRequired = union(curNode.keysRequired, additionallyRequiredKeys);
		const dir = pickLinkDirection(curNode, newNode);
		const pit = dir == DIR_DOWN && opts.allowOneWaysInPrimaryPath && Math.random() < 0.5; 
		connectNodes(curNode, dir, newNode, !pit);
		path.directions.push(dir);
		curNodeId = newNodeId;
		--len;
	}
	path.endNodeId = curNodeId;
	return path;
}

function union<T>( a:KeyedList<T>, b:KeyedList<T> ):KeyedList<T> {
	let aIsComplete:boolean = true;
	let bIsComplete:boolean = true;
	for( let k in a ) if( !b[k] ) bIsComplete = false;
	if( bIsComplete ) return b;
	for( let k in b ) if( !a[k] ) aIsComplete = false;
	if( aIsComplete ) return a;
	const union:KeyedList<T> = {};
	for( let k in a ) union[k] = a[k];
	for( let k in b ) union[k] = b[k];
	return union;
}

function isSubset<T>( a:KeyedList<T>, b:KeyedList<T> ):boolean {
	for( let k in a ) if( !b[k] ) return false;
	return true;
}

function isSameSet<T>( a:KeyedList<T>, b:KeyedList<T> ):boolean {
	return isSubset(a,b) && isSubset(b,a);
}

function generatePrimaryPaths(nodes:MazeGraphNode[], startNodeId:number, opts:MazeGenerationOptions, ):number {
	let p0 = generatePrimaryPath(nodes, startNodeId, opts);
	
	const keysRequiredForFinish:KeyedList<boolean> = {}
	for( let i = 0; i < Math.min(keyClassRefs.length, opts.requiredKeyCount); ++i ) {
		const key = keyClassRefs[i];
		keysRequiredForFinish[key] = true;
		let pathToKey:MazePath|undefined;
		attemptPath: for( let a=0; a<5; ++a ) { 
			const startNode = pickOne(nodes);
			try {
				pathToKey = generatePrimaryPath(nodes, p0.endNodeId, opts);
			} catch( err ) {
				continue attemptPath;
			}
			nodes[pathToKey.endNodeId].items[key] = key;
			break attemptPath;
		}
		if( pathToKey == undefined ) throw new Error("Failed to create a path");
		
		generateBranches(nodes, Math.max(4, opts.maxRoomCount-nodes.length));
		generateBranches(nodes, Math.max(4, opts.maxRoomCount-nodes.length), {[key]: true});
	}
	
	const startNode = pickOne(nodes);
	let pathToEnd = generatePrimaryPath(nodes, p0.endNodeId, opts, keysRequiredForFinish);
	generateBranches(nodes, Math.max(4, opts.maxRoomCount-nodes.length), keysRequiredForFinish);
	
	return pathToEnd.endNodeId;
	
	// Generate unlocked branches
	// For each key:
	//   Pick random node
	//   Generate primary path
	//   Place key
	//   XX Generate normal branches
	//   XX Generate branches requiring keys
	// Pick random node
	//   generate primary path requiring all keys
	// Generate loops
}

function pickOne<T>( things:T[] ):T {
	if( things.length == 0 ) throw new Error("Can't pick from zero-length list");
	const i = Math.floor(Math.random()*things.length);
	return things[i];
}

function pick<T>( things:T[], pickAttempts:number, fitFunction:(node:T)=>number ):T {
	let bestFit:T|undefined = undefined;
	let bestFitness:number = -Infinity;
	for( let i=0; i<pickAttempts; ++i ) {
		const t = pickOne(things)
		const f = fitFunction(t);
		if( f > bestFitness ) {
			bestFit = t;
			bestFitness = f;
		}
	}
	
	if( bestFitness > 0 ) return bestFit!; 
	
	for( let i=0; i<things.length; ++i ) {
		const o = Math.floor(Math.random()*things.length);
		const i2 = (i+o) % things.length;
		if( fitFunction(things[i2]) > 0 ) {
			return things[i2];
		}
	}
	
	throw new Error("Failed to find anything with fitness > 0");
}

function neighborCount( node:MazeGraphNode ):number {
	let count = 0;
	for( let i=0; i<node.neighborIds.length; ++i ) {
		if( node.neighborIds[i] != undefined ) ++count;
	}
	return count;
}

function digNode( nodes:MazeGraphNode[], node:MazeGraphNode, direction:number, bidirectional:boolean, additionallyRequiredKeys:KeyedList<boolean>={} ):MazeGraphNode {
	const newNode = newMazeNode(nodes, node);
	newNode.keysRequired = union(node.keysRequired, additionallyRequiredKeys);
	connectNodes( node, direction, newNode, bidirectional );
	return newNode;
}

function hasFreeHorizontalLinks( node:MazeGraphNode ) {
	if( node.neighborIds[0] == undefined ) return true;
	if( node.neighborIds[2] == undefined ) return true;
	return false;
} 

function generateBranches( nodes:MazeGraphNode[], maxRoomCount:number, additionallyRequiredKeys:KeyedList<boolean>={} ) {
	try {
		while( nodes.length < maxRoomCount ) {
			const n = pick( nodes, 4, (node:MazeGraphNode):number => {
				if( !isSubset(additionallyRequiredKeys, node.keysRequired) && !hasFreeHorizontalLinks(node) ) return 0;
				if( node.isEndRoom ) return 0.1;
				return Math.min(2, 4 - neighborCount(node));
			});
			const needHorizontal = !isSubset(additionallyRequiredKeys, n.keysRequired);
			const dir = pickLinkDirection(n, undefined, d => (!needHorizontal || directionIsHorizontal(d)) ? 1 : 0);
			digNode( nodes, n, dir, true, additionallyRequiredKeys );
		}
	} catch( err ) {
		console.warn("Failed to load connect as many branches as we wanted.");
	}
}

function populateDistances( graph:MazeGraph, nodeId:number=graph.endNodeId, distance:number=0 ) {
	const node = graph.nodes[nodeId];
	if( node.distanceFromEnd != undefined && node.distanceFromEnd <= distance ) return;
	node.distanceFromEnd = distance;
	for( let i=0; i<4; ++i ) {
		if( node.neighborIds[i] != undefined ) {
			if( i == DIR_DOWN && !node.ladderDown ) continue; // Ha ha can't jump up here
			populateDistances( graph, node.neighborIds[i], distance+1 );
		}
	}
}

/**
 * Returns 1 when n0 == n1, and something (0..1] for values further apart.
 */
function closeness( n0:number, n1:number ):number {
	return 1 / (1+Math.abs(n0 - n1));
}

function connectLoops( nodes:MazeGraphNode[], count:number ) {
	let loopCount = 0;
	try {
		for( let i=0; i<count; ++i ) {
			const n0 = pick(nodes, 4, (n) => Math.max(2, 4 - n.neighborIds.length) );
			const n1 = pick(nodes, 4, (n) => {
				if( !nodesConnectable(n,n0) ) return 0;
				// If they can be connected vertically
				const closeyness:number = nodesConnectable(n0,n, (dir) => dir == DIR_DOWN ? 1 : 0) ?
					1 : closeness(n.distanceFromEnd!, n0.distanceFromEnd!);
				return Math.max(1, (2 - n.neighborIds.length)) * closeyness;
			});
			const allowFallToN1 = (n0.distanceFromEnd < n1.distanceFromEnd) && isSubset(n1.keysRequired, n0.keysRequired);
			const allowFallToN0 = (n1.distanceFromEnd < n0.distanceFromEnd) && isSubset(n0.keysRequired, n1.keysRequired);
			// Make the maze 'hard' by always having one-ways go backwards when possible
			if( allowFallToN1 ) {
				try {
					connectNodes(n0, DIR_DOWN, n1, false);
					return;
				} catch( err ) {}
			}
			if( allowFallToN0 ) {
				try {
					connectNodes(n1, DIR_DOWN, n0, false);
					return;
				} catch( err ) {}
			}
			// Otherwise just connect them in whatever way possible.
			connectNodes(n0, undefined, n1, undefined);
			++loopCount;
		}
	} catch( err ) {
		console.warn("Failed to make as many loops as we wanted ("+loopCount+" of "+count+")");
	}
}

function generateMazeGraph(opts:MazeGenerationOptions):Promise<MazeGraph> {
	const nodes:MazeGraphNode[] = [];
	nodes.push(blankMazeNode(0));
	nodes[0].isStartRoom = true;
	const endNodeId:number = generatePrimaryPaths( nodes, 0, opts );
	//const solution = 
	nodes[endNodeId].isEndRoom = true;
	generateBranches( nodes, opts.maxRoomCount );
	const mazeGraph:MazeGraph = {
		startNodeId: 0,
		endNodeId,
		nodes,
	};
	populateDistances(mazeGraph);
	//console.log("Minimum distance: "+nodes[0].distanceFromEnd);
	connectLoops( nodes, opts.maxRoomCount / 8 );
	return Promise.resolve(mazeGraph);
}

import KeyedList from '../KeyedList';
import Vector3D from '../Vector3D';
import AABB from '../AABB';
import {
	makeAabb
} from '../aabbs';
import GameDataManager from '../GameDataManager';
import {
	Room, RoomNeighbor
} from '../world';
import {
	connectRooms,
	makeTileTreeRef,
	roomNeighborKey,
} from '../worldutil';
import {
	newType4Uuid,
	uuidUrn,
} from '../../tshash/uuids';
import * as dat from '../maze1demodata';

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

function clamp( min:number, v:number, max:number ) {
	return v < min ? min : v > max ? max : v;
}

function nodeTileIndexes(mgn:MazeGraphNode):number[] {
	/*
	 * Bricks:
	 *  1 = light gray
	 * 14 = brown
	 * 15 = blue
	 * 19 = yellow
	 * 20 = red
	 * 21 = gray
	 */
	
	let brik:number;
	if( mgn.isStartRoom ) brik = 14;
	else if( mgn.isEndRoom ) brik = 1;
	else if( mgn.keysRequired[dat.redKeyEntityClassId] ) brik = 20;
	else if( mgn.keysRequired[dat.yellowKeyEntityClassId] ) brik = 19;
	else if( mgn.keysRequired[dat.blueKeyEntityClassId] ) brik = 15;
	else brik = 21;
	
	let tileIndexes:number[] = [];
	for( let i=0; i<64; ++i ) tileIndexes[i] = brik;
	
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
	
	const vineTop = randInt(-1,3);
	const vineBottom = randInt(1,7);
	
	for( let x=leftWallX; x<rightWallX; ++x ) {
		const vineColumnTop = clamp( 1, randInt(1, vineTop), 4 );
		const vineColumnBottom = clamp( 1, randInt(1, vineBottom), 4 );
		fill( tileIndexes, x,vineColumnTop, x+1,vineColumnBottom, 8 );
	}
	
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
function mazeToRooms(mg:MazeGraph, gdm:GameDataManager, tileEntityPaletteRef:string):Promise<MazeGraph> {
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
			tileEntityPaletteRef,
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

import { sha1Urn } from '../../tshash/index';
import Datastore from '../Datastore';
import HTTPHashDatastore from '../HTTPHashDatastore';
import { SaveGame } from '../Maze1';

function strictParseInt(r:string, min:number, max:number, ctx:string) {
	const v = parseInt(r);
	if( isNaN(v) ) throw new Error(ctx+" '"+r+"' did not parse as a number");
	if( v < min || v > max ) throw new Error(ctx+" must be between "+min+" and "+max+" (inclusive); "+v+" is not");
	return v;
}

if( typeof require != 'undefined' && typeof module != 'undefined' && require.main === module ) {
	const dataIdent = sha1Urn;
	const ds:Datastore<Uint8Array> = HTTPHashDatastore.createDefault();
	const gdm:GameDataManager = new GameDataManager(ds);
	
	const mgOpts = {
		primaryPathLength: 8,
		maxRoomCount: 16,
		allowOneWaysInPrimaryPath: true,
		requiredKeyCount: 2,
	};
	
	let maxRoomCount:number|undefined = undefined;
	let primaryPathLength:number|undefined = undefined;
	
	const argv = process.argv;
	for( let i=2; i<argv.length; ++i ) {
		const arg = argv[i];
		if( arg == '-size' ) {
			maxRoomCount = strictParseInt(argv[++i], 1, 1024, "size");
		} else if( arg == '-length' ) {
			primaryPathLength = strictParseInt(argv[++i], 1, 1024, "length");
		} else if( arg == '-no-mandatory-one-ways' ) {
			mgOpts.allowOneWaysInPrimaryPath = false;
		} else {
			console.error("Unrecognized argument "+i+": ''"+arg+"'");
			console.error("Argv:", argv);
			process.exit(1);
		}
	}
	
	if( maxRoomCount ) {
		mgOpts.maxRoomCount = maxRoomCount;
		mgOpts.primaryPathLength = primaryPathLength || maxRoomCount / 2;
	} else {
		if( !primaryPathLength ) primaryPathLength = 8;
		maxRoomCount = primaryPathLength*2;
		mgOpts.maxRoomCount = maxRoomCount;
		mgOpts.primaryPathLength = primaryPathLength;
	}
	
	const addPlayer = true;
	const saveGame = true;
	
	console.log("Generating maze graph...");
	
	let mg : MazeGraph;
	generateMazeGraph( mgOpts ).then( (_mg:MazeGraph) => {
		mg = _mg;
		return dat.initData(gdm);
	}).then( () => gdm.fetchHardRef(dat.tileEntityPaletteId) ).then( (tileEntityPaletteRef) => {
		return mazeToRooms(mg, gdm, tileEntityPaletteRef);
	}).then( (mg:MazeGraph) => {
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
	}).then( (mg:MazeGraph) => {
		//const dirStrs:string[] = mg.solution.directions.map(directionToString);
		//console.log("Solution from "+mg.solution.startNodeId+" to " +mg.solution.endNodeId+": "+dirStrs.join(","));
		console.log("Root room ref: "+mg.nodes[0].roomRef);
		for( let i=0; i<mg.nodes.length; ++i ) {
			if( mg.nodes[i].isStartRoom ) console.log("Start room: "+mg.nodes[i].roomRef);
			if( mg.nodes[i].isEndRoom ) console.log("End room: "+mg.nodes[i].roomRef);
		}
		return mg;
	}).then( (mg:MazeGraph) => {
		console.log("Saving...");
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
