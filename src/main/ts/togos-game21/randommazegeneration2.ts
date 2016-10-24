/// <reference path="../node.d.ts"/>

/*
 * Let's begin again.
 * 
 * Procedure:
 * - Create start node
 * - Dig path -> start area
 * - For each key:
 *   - Pick random node from anywhere in the maze
 *   - Random path to key -> collection A
 *   - Create some random branches from nodes in collection A -> collection B
 *   - Create some random branches requiring the placed key
 * - Pick a random node
 * - Random path to exit -> collection C
 * - Random branches from nodes in collection C
 * - Add link loops between areas requiring the same key or
 *   one way links to areas requiring fewer keys
 * 
 * Where 'dig path' means adding a linear string of nodes.
 * 'Random branch' is the same except making a tree instead of a linear path.
 * 
 * It's fine to include one-way links in any path so long as the end of the path
 * comes out somewhere 'before' the one-way link (requiring no more keys)
 */

import KeyedList from './KeyedList';

type KeySet = KeyedList<boolean>;

export interface MazeLinkAttributes {
	locks : KeySet
	allowsForwardMovement : boolean;
	allowsBackwardMovement : boolean;
	
	direction? : number;
}

const DEFAULT_LINK_ATTRIBUTES:MazeLinkAttributes = {
	locks: {},
	allowsForwardMovement: true,
	allowsBackwardMovement: true,
}

export interface MazeLinkEndpoint {
	nodeId : number;
	linkNumber : number;
}

export interface MazeLink extends MazeLinkAttributes {
	id : number;
	endpoint0 : MazeLinkEndpoint;
	endpoint1 : MazeLinkEndpoint;
}

export interface Maze {
	nodes : MazeNode[];
	links : MazeLink[];
}

export const ITEMCLASS_START = 'start';
export const ITEMCLASS_END = 'end';
export const ITEMCLASS_BLUEKEY = 'redKey';
export const ITEMCLASS_YELLOWKEY = 'yellowKey';
export const ITEMCLASS_REDKEY = 'blueKey';

export interface MazeNode {
	id : number;
	linkIds : number[];
	requiredKeys : KeySet;
	items : KeyedList<string>;
}

type MazeNodeCollection = Node[];
type FitnessFunction<T> = (x:T)=>number;

const EVERYTHING_FITS:FitnessFunction<any> = (x)=>1;

function nMostFit<T>( coll:T[], count:number, fitnessFunction:FitnessFunction<T>, collectionDescription:string="items", minFitness:number=0, minCount:number=1 ):T[] {
	type WithFitness<T> = [T,number];
	const withFitness = coll.map( (n):WithFitness<T> => [n,fitnessFunction(n)] ); 
	const filtered = withFitness.filter( ([n,fit]) => fit >= minFitness );
	if( filtered.length < minCount ) throw new Error("Found only "+filtered.length+" of "+minCount+" "+collectionDescription);
	const sorted = filtered.sort( ([n0,fit0],[n1,fit1]) => fit0 > fit1 ? -1 : fit0 == fit1 ? 0 : -1 );
	return sorted.slice(0, count).map( ([n,fit]) => n );
}

function pickOne<T>( coll:T[], fitnessFunction:FitnessFunction<T>=EVERYTHING_FITS, resultDescription:string="item" ):T {
	if( coll.length == 0 ) throw new Error("Can't pick "+resultDescription+" from zero-length collection");
	const startIdx = Math.floor(Math.random()*coll.length);
	for( let i=0; i<coll.length; ++i ) {
		// TODO: This is biased towards finding the first fitting node after a series of unfit ones
		const idx = (i+startIdx) % coll.length;
		if( fitnessFunction(coll[idx]) > 0 ) return coll[idx];
	}
	throw new Error("No fit items in collection");
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

export class MazeGenerator {
	protected targetNodeCount : number = 32;
	protected nodes : MazeNode[] = [];
	protected links : MazeLink[] = [];
	protected currentNodeCollection : MazeNode[] = [];
	protected _selectedNode : MazeNode|undefined;
	protected startNode : MazeNode;
	public requireKeys : string[] = [];
	
	protected get selectedNode() {
		if( this._selectedNode == undefined ) throw new Error("No selected node!");
		return this._selectedNode;
	}
	
	public newCollection() {
		this.currentNodeCollection = [];
		return this.currentNodeCollection;
	}
	
	public flushCollection() {
		const c = this.currentNodeCollection;
		this.newCollection();
		return c;
	}
	
	protected newNode():MazeNode {
		const n:MazeNode = {
			id: this.nodes.length,
			linkIds: [],
			requiredKeys: {},
			items: {}
		};
		this.nodes.push(n);
		this.currentNodeCollection.push(n);
		this._selectedNode = n;
		return n;
	}
	
	public createStartNode() {
		const n = this.newNode();
		n.items[ITEMCLASS_START] = ITEMCLASS_START;
		this.startNode = n;
		return n;
	}
	
	public selectRandomNode(collection:MazeNode[]=this.nodes, fitnessfunction:FitnessFunction<MazeNode>=EVERYTHING_FITS, resultDescription:string="node"):MazeNode {
		const subCollection = fitnessfunction === EVERYTHING_FITS ? collection : nMostFit(collection,4,fitnessfunction,resultDescription);
		if( subCollection.length == 0 ) throw new Error("Collection is empty; can't pick "+resultDescription);
		return this._selectedNode = pickOne(subCollection, EVERYTHING_FITS, resultDescription);
	}
	
	public linkNodes(n0:MazeNode, n1:MazeNode, linkAttrs:MazeLinkAttributes) {
		const newLinkId = this.links.length;
		const n0LinkNumber = n0.linkIds.length; 
		n0.linkIds.push(newLinkId);
		const n1LinkNumber = n1.linkIds.length;
		n1.linkIds.push(newLinkId);
		const link:MazeLink = {
			id: newLinkId,
			endpoint0: { nodeId: n0.id, linkNumber: n0LinkNumber },
			endpoint1: { nodeId: n1.id, linkNumber: n1LinkNumber },
			allowsBackwardMovement: linkAttrs.allowsBackwardMovement,
			allowsForwardMovement: linkAttrs.allowsForwardMovement,
			locks: linkAttrs.locks,
			direction: linkAttrs.direction,
		};
		this.links.push(link);
		return link;
	}
	
	public dig( linkAttrs:MazeLinkAttributes=DEFAULT_LINK_ATTRIBUTES ) {
		const n0 = this.selectedNode;
		if( n0 == undefined ) throw new Error("Can't dig; no currently selected node"); 
		const n1 = this.newNode();
		n1.requiredKeys = union(n0.requiredKeys, linkAttrs.locks);
		this.linkNodes(n0, n1, linkAttrs);
		this._selectedNode = n1;
		return n1;
	}
	
	public digPath(len:number, entranceLocks:KeySet={}) {
		for( let i=0; i<len; ++i ) {
			this.dig({
				allowsForwardMovement: true,
				allowsBackwardMovement: true,
				locks: i == 0 ? entranceLocks : {},
			});
			--len;
		}
	}
	
	public placeItem(classRef:string) {
		if( this.selectedNode == null ) throw new Error("No node currently selected");
		this.selectedNode.items[classRef] = classRef;
	}
	
	protected pickLoopOutputNode() {
		const inputKeys:KeySet = this.selectedNode.requiredKeys;
		return pickOne(this.nodes, (n) => {
			return isSubset(n.requiredKeys, inputKeys) ? 1 / n.linkIds.length : 0;
		}, "loop output node");
	}
	
	protected digOneWayLoop(length:number, endNode:MazeNode=this.pickLoopOutputNode(), entranceLocks:KeySet={}):void {
		for( let i=0; i<length; ++i ) {
			this.dig({
				allowsForwardMovement: true,
				allowsBackwardMovement: Math.random() < 0.125,
				locks: i == 0 ? entranceLocks : {},
			});
		}
		this.linkNodes(this.selectedNode!, endNode, {
			allowsForwardMovement: true,
			allowsBackwardMovement: false,
			locks: {}
		});
	}
	
	protected digBranches(newNodeCount:number, originNodes:MazeNode[], entranceLocks:KeySet={}):void {
		const totalCollection = originNodes.slice(0, originNodes.length);
		for( let i=0; i<newNodeCount; ++i ) {
			this._selectedNode = pickOne(totalCollection, EVERYTHING_FITS, "branch start node");
			totalCollection.push(this.dig({
				allowsForwardMovement: true,
				allowsBackwardMovement: true,
				locks: i == 0 ? entranceLocks : {},
			}));
		}
	}
	
	/**
	 * Digs either a linear or looping path.
	 * Sets the current node to some node somewhere in the path.
	 */
	protected digSomeKindOfPath(length:number, entranceLocks:KeySet={}) {
		if( length <= 0 ) return;
		if( Math.random() < 0.5 ) this.digPath(length, entranceLocks);
		else {
			let start = this.nodes.length;
			this.digOneWayLoop(length, undefined, entranceLocks);
			let end = this.nodes.length;
			this._selectedNode = this.nodes[start+Math.floor(Math.random()*(end-start))];
		}
	}
	
	public generate():Maze {
		this.createStartNode();
		
		this.newCollection();
		this.dig();
		const stdPathLen = Math.max(1, this.targetNodeCount / (this.requireKeys.length * 6 + 1));
		this.digSomeKindOfPath(stdPathLen-1);
		this.digBranches(stdPathLen, this.currentNodeCollection);
		
		for( let k in this.requireKeys ) {
			const keyClassRef = this.requireKeys[k];
			this.newCollection();
			this.selectRandomNode();
			this.digPath(2);
			this.placeItem(keyClassRef);
			this.digBranches(stdPathLen, this.currentNodeCollection);
			this.digBranches(stdPathLen, this.nodes, { [keyClassRef]: true });
		}
		
		// Make path to end
		this.selectRandomNode();
		for( let k in this.requireKeys ) {
			this.newCollection();
			const keyClassRef = this.requireKeys[k];
			this.digSomeKindOfPath(stdPathLen, { [keyClassRef]: true });
			this.digBranches(stdPathLen, this.currentNodeCollection);
		}
		this.placeItem(ITEMCLASS_END);
		return this.maze;
	}
	
	public get maze():Maze {
		return {
			nodes: this.nodes,
			links: this.links,
		};
	}
}

export interface MazePlayerState {
	items : KeyedList<string>;
	nodeId : number;
}

interface SolveState {
	player : MazePlayerState;
	solution : MazeSolution;
}

type MazeSolution = number[]; // link numbers to follow

export function playerStateId(ps:MazePlayerState):string {
	const itemStrs:string[] = [];
	for( let k in ps.items ) itemStrs.push(k); 
	return '@' + ps.nodeId + "+" + itemStrs.join(',');
}

export interface MazeReplayWatcher {
	at( s:MazePlayerState ):void;
	passed( linkNumber:number, link:MazeLink ):void;
}

export class MazeTester {
	protected solveStates:SolveState[] = [];
	protected enqueuedPlayerStates:KeyedList<boolean> = {};
	public deadEnds:KeyedList<SolveState> = {};
	public solutions:KeyedList<number[]> = {};
	public shortestSolution:MazeSolution|undefined;
	
	public constructor(protected maze:Maze) { }
	
	protected enqueueSolveStep(state:SolveState):void {
		if( this.shortestSolution && state.solution.length > this.shortestSolution.length ) {
			return;
		}
		const stateId = playerStateId(state.player);
		if( this.enqueuedPlayerStates[stateId] ) return;
		this.enqueuedPlayerStates[stateId] = true;
		this.solveStates.push(state);
	}
	
	protected solveStep(state:SolveState):void {
		const player = state.player;
		const soln = state.solution;
		const solnId = soln.join(",");
		const node = this.maze.nodes[player.nodeId];
		if( node.items[ITEMCLASS_END] ) {
			this.solutions[solnId] = soln;
			if( this.shortestSolution == undefined || soln.length < this.shortestSolution.length ) {
				this.shortestSolution = soln;
			}
		}
		
		let newItems = union(player.items, node.items);
		
		let deadEnd = true;
		const lOffset = Math.floor(Math.random()*node.linkIds.length);
		links: for( let l=0; l<node.linkIds.length; ++l ) {
			const linkNumber = (lOffset+l) % node.linkIds.length;
			const linkId = node.linkIds[linkNumber];
			const link = this.maze.links[linkId];
			const isForward = (node.id == link.endpoint0.nodeId && linkNumber == link.endpoint0.linkNumber);
			if(  isForward && !link.allowsForwardMovement  ) continue links;
			if( !isForward && !link.allowsBackwardMovement ) continue links;
			for( let lock in link.locks ) {
				if( !newItems[lock] ) continue links;
			}
			// We can go this way!
			this.enqueueSolveStep({
				player: {
					nodeId: isForward ? link.endpoint1.nodeId : link.endpoint0.nodeId, 
					items: newItems,
				},
				solution: soln.concat( linkNumber ),
			});
			deadEnd = false;
		}
		
		if( deadEnd ) {
			this.deadEnds[solnId] = state;
		}
	}
	
	public solve():MazeSolution|undefined {
		this.enqueueSolveStep({
			player: {
				nodeId: 0,
				items: {},
			},
			solution: [],
		});
		for( let i=0; i<this.solveStates.length; ++i ) {
			this.solveStep(this.solveStates[i]);
		}
		return this.shortestSolution;
	}
	
	public assertGoodMaze():void {
		if( this.shortestSolution == undefined ) {
			throw new Error("Maze is unsolveable");
		}
		for( let de in this.deadEnds ) {
			const deNode = this.maze.nodes[this.deadEnds[de].player.nodeId];
			const deLinks:MazeLink[] = [];
			for( let l in deNode.linkIds ) {
				deLinks.push(this.maze.links[deNode.linkIds[l]]);
			}
			console.error("Dead-end: "+JSON.stringify({
				nodeId: deNode.id,
				links: deLinks,
				items: deNode.items,
				nodeRequiredKeys: deNode.requiredKeys,
			}, null, "\t"));
			throw new Error("Maze contains at least one uenscapable dead-end: "+playerStateId(this.deadEnds[de].player));
		}
	}
	
	public replaySolution(soln:MazeSolution, watcher:MazeReplayWatcher):void {
		let playerState:MazePlayerState = {
			nodeId: 0,
			items: {[ITEMCLASS_START]: ITEMCLASS_START},
		};
		watcher.at(playerState);
		for( let i in soln ) {
			const linkNumber = soln[i];
			const node = this.maze.nodes[playerState.nodeId];
			const linkId = node.linkIds[linkNumber];
			const link = this.maze.links[linkId];
			watcher.passed(linkNumber, link);
			const newEndpoint = (link.endpoint0.nodeId == playerState.nodeId && link.endpoint0.linkNumber == linkNumber) ? link.endpoint1 : link.endpoint0;
			const newNode = this.maze.nodes[newEndpoint.nodeId];
			playerState = {
				nodeId: newEndpoint.nodeId,
				items: union(playerState.items, newNode.items),
			};
			watcher.at(playerState);
		}
	}
}

if( typeof require != 'undefined' && typeof module != 'undefined' && require.main === module ) {
	const generator = new MazeGenerator();
	generator.requireKeys = [ITEMCLASS_BLUEKEY];
	const maze = generator.generate();
	console.log(JSON.stringify(maze, null, "\t"));
}
