/// <reference path="../node.d.ts"/>

/*
 * Let's begin again.
 * 
 * Procedure:
 * - Create start node
 * - For each key:
 *   - Pick random node from anywhere in the maze
 *   - Random path to first key -> collection A
 *   - Create some random branches from nodes in collection A -> collection B
 *   - Create some random branches requiring the placed key
 * - Pick a random node
 * - Random path to exit -> collection C
 * - Random branches from nodes in collection C
 * 
 * Where 'random path' means adding a linear string of nodes.
 * 'Random branch' is the same except making a tree instead of a linear path.
 * 
 */

import KeyedList from './KeyedList';

type KeySet = KeyedList<boolean>;

interface MazeLinkAttributes {
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

interface MazeLinkEndpoint {
	nodeId : number;
	linkNumber : number;
}

interface MazeLink extends MazeLinkAttributes {
	id : number;
	endpoint0 : MazeLinkEndpoint;
	endpoint1 : MazeLinkEndpoint;
}

interface Maze {
	nodes : MazeNode[];
	links : MazeLink[];
}

const ITEMCLASS_START = 'start';
const ITEMCLASS_END = 'end';
import {
	keyDoorClassRefs,
	blueKeyEntityClassId,
	yellowKeyEntityClassId,
	redKeyEntityClassId,
} from './maze1demodata';

interface MazeNode {
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

function pickOne<T>( coll:T[] ):T {
	if( coll.length == 0 ) throw new Error("Can't pick from zero-length collection");
	const idx = Math.floor(Math.random()*coll.length);
	return coll[idx];
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

class MazeGenerator {
	protected remainingNodeCount : number = 32;
	protected nodes : MazeNode[] = [];
	protected links : MazeLink[] = [];
	protected nodeCollection : MazeNode[] = [];
	protected selectedNode : MazeNode|undefined;
	protected startNode : MazeNode;
	
	public newCollection() {
		this.nodeCollection = [];
		return this.nodeCollection;
	}
	
	public flushCollection() {
		const c = this.nodeCollection;
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
		this.nodeCollection.push(n);
		this.selectedNode = n;
		return n;
	}
	
	public createStartNode() {
		const n = this.newNode();
		n.items[ITEMCLASS_START] = ITEMCLASS_START;
		this.startNode = n;
		this.selectedNode = n;
		return n;
	}
	
	public selectRandomNode(collection:MazeNode[]=this.nodes, fitnessfunction:FitnessFunction<MazeNode>=EVERYTHING_FITS, collectionDescription:string="nodes"):MazeNode {
		const subCollection = fitnessfunction === EVERYTHING_FITS ? collection : nMostFit(collection,4,fitnessfunction,collectionDescription);
		if( subCollection.length == 0 ) throw new Error("Collection is empty; can't pick "+collectionDescription) 
		return this.selectedNode = pickOne(subCollection);
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
		}
		this.links.push(link);
		return link;
	}
	
	public dig( linkAttrs:MazeLinkAttributes=DEFAULT_LINK_ATTRIBUTES ) {
		const n0 = this.selectedNode;
		if( n0 == undefined ) throw new Error("Can't dig; no currently selected node"); 
		const n1 = this.newNode();
		this.linkNodes(n0, n1, linkAttrs);
		//this.selectedNode = n1;
		return n1;
	}
	
	public randomPath(len:number) {
		while( len > 0 ) {
			this.selectedNode = this.dig();
			--len;
		}
	}
	
	public placeItem(classRef:string) {
		if( this.selectedNode == null ) throw new Error("No node currently selected");
		this.selectedNode.items[classRef] = classRef;
	}
	
	public generate():Maze {
		this.createStartNode();
		this.randomPath(2);
		this.placeItem(ITEMCLASS_END);
		const region = this.flushCollection();
		return this.maze;
	}
	
	public get maze():Maze {
		return {
			nodes: this.nodes,
			links: this.links,
		}
	}
}

interface MazePlayer {
	items : KeyedList<string>;
	nodeId : number;
}

interface SolveState {
	player : MazePlayer;
	solution : MazeSolution;
}

type MazeSolution = number[]; // link numbers to follow

class MazeTester {
	protected solveStates:SolveState[] = [];
	protected enqueuedSolves:KeyedList<number[]> = {};
	protected deadEnds:KeyedList<number[]> = {};
	protected solutions:KeyedList<number[]> = {};
	
	public constructor(protected maze:Maze) { }
	
	protected enqueueSolveStep(state:SolveState):void {
		const solnId = state.solution.join(",");
		if( this.enqueuedSolves[solnId] ) return;
		this.enqueuedSolves[solnId] = state.solution;
		this.solveStates.push(state);
	}
	
	protected solveStep(state:SolveState):void {
		const player = state.player;
		const soln = state.solution;
		const solnId = soln.join(",");
		const node = this.maze.nodes[player.nodeId];
		if( node.items[ITEMCLASS_END] ) {
			this.solutions[solnId] = soln;
		}
		
		let newItems = union(player.items, node.items);
		
		let deadEnd = true;
		links: for( let l=0; l<node.linkIds.length; ++l ) {
			const linkId = node.linkIds[l];
			const link = this.maze.links[linkId];
			const isForward = (node.id == link.endpoint0.nodeId && l == link.endpoint0.linkNumber);
			if( isForward && !link.allowsForwardMovement ) continue links;
			if( isForward && !link.allowsBackwardMovement ) continue links;
			for( let lock in link.locks ) {
				if( newItems[lock] ) continue links;
			}
			// We can go this way!
			this.solveStates.push({
				player: {
					nodeId: isForward ? link.endpoint1.nodeId : link.endpoint0.nodeId, 
					items: newItems,
				},
				solution: soln.concat( l ),
			});
			deadEnd = false;
		}
		
		if( deadEnd ) {
			this.deadEnds[solnId] = soln;
		}
	}
	
	public test():MazeSolution|undefined {
		this.enqueueSolveStep({
			player: {
				nodeId: 0,
				items: {},
			},
			solution: [],
		});
		for( let i=0; i<1000 && i<this.solveStates.length; ++i ) {
			this.solveStep(this.solveStates[i]);
		}
		for( let solnId in this.deadEnds ) {
			console.warn("Found dead-end: "+solnId);
		}
		let shortestSolutionLength = Infinity;
		let shortestSolution:MazeSolution|undefined = undefined;
		for( let solnId in this.solutions ) {
			const soln = this.solutions[solnId];
			if( soln.length < shortestSolutionLength ) {
				shortestSolution = soln;
				shortestSolutionLength = soln.length;
			}
		}
		return shortestSolution;
	}
}

if( typeof require != 'undefined' && typeof module != 'undefined' && require.main === module ) {
	const generator = new MazeGenerator();
	const maze = generator.generate();
	console.log(JSON.stringify(maze, null, "\t"));
	///
	console.log("Solving...");
	const soln = new MazeTester(maze).test();
	console.log("Shortest solution: "+soln);
}
