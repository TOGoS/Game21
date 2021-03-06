/// <reference path="../../node.d.ts"/>

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

import KeyedList from '../KeyedList';
import { union, isSubset, difference, symmetricDifference, isEmpty } from './setutil';
import { FitnessFunction, EVERYTHING_FITS, nMostFit, randInt, bestFit } from './picking';
import {
	MazeNode,
	MazeLink,
	MazeLinkAttributes,
	DEFAULT_LINK_ATTRIBUTES,
	KeySet,
	Maze,
	ITEMCLASS_START,
	ITEMCLASS_END,
	ITEMCLASS_BLUEKEY,
	ITEMCLASS_YELLOWKEY,
	ITEMCLASS_REDKEY,
} from '../graphmaze';

type MazeNodeCollection = Node[];

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

export default class MazeGenerator {
	protected generatorName : string = "xxx";
	public targetNodeCount : number = 32;
	protected nodes : MazeNode[] = [];
	protected links : MazeLink[] = [];
	protected currentNodeCollection : MazeNode[] = [];
	protected _selectedNode : MazeNode|undefined;
	protected startNode : MazeNode;
	public requireKeys : string[] = [];
	public complectificationFactor:number = 1/2;
	
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
	
	public randomNode(collection:MazeNode[]=this.nodes, fitnessfunction:FitnessFunction<MazeNode>=EVERYTHING_FITS, resultDescription:string="node") {
		const subCollection = fitnessfunction === EVERYTHING_FITS ? collection : nMostFit(collection, Math.max(2,collection.length/4),fitnessfunction,resultDescription);
		if( subCollection.length == 0 ) throw new Error("Collection is empty; can't pick "+resultDescription);
		return pickOne(subCollection, EVERYTHING_FITS, resultDescription);
	}
	
	public selectRandomNode(collection:MazeNode[]=this.nodes, fitnessfunction:FitnessFunction<MazeNode>=EVERYTHING_FITS, resultDescription:string="node"):MazeNode {
		return this._selectedNode = this.randomNode(collection, fitnessfunction, resultDescription);
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
			const linkLocks = i == 0 ? entranceLocks : {};
			this.dig({
				allowsForwardMovement: true,
				allowsBackwardMovement: !isEmpty(linkLocks) || Math.random() < 0.75,
				locks: linkLocks,
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
	
	protected accessibleNeighbors(node:MazeNode) {
		const others:MazeNode[] = [];
		links: for( let l=0; l<node.linkIds.length; ++l ) {
			const link = this.links[node.linkIds[l]];
			const isForward = (link.endpoint0.nodeId == node.id && link.endpoint0.linkNumber == l);
			if( (isForward && !link.allowsForwardMovement) || (!isForward && !link.allowsBackwardMovement) ) continue links;
			const otherEndpoint = isForward ? link.endpoint1 : link.endpoint0;
			const otherNodeId = otherEndpoint.nodeId;
			others.push(this.nodes[otherNodeId]); 
		}
		return others;
	}
	
	public calculateNodeDistances(startNode:MazeNode) {
		for( let i=0; i<this.nodes.length; ++i ) this.nodes[i].distanceValue = undefined;
		startNode.distanceValue = 0;
		const q = [startNode];
		for( let i=0; i<q.length; ++i ) {
			const curNode = q[i];
			const neighbors = this.accessibleNeighbors(curNode);
			for( let n in neighbors ) {
				const neighb = neighbors[n];
				if( neighb.distanceValue == undefined || neighb.distanceValue > curNode.distanceValue ) {
					neighb.distanceValue = curNode.distanceValue+1;
					q.push(neighb);
				}
			}
		}
	}
	
	protected init(generatorName:string) {
		this.nodes = [];
		this.links = [];
		this.generatorName = generatorName;
		this.currentNodeCollection = [];
		this._selectedNode = undefined;
	}
	
	/**
	 * For each stage:
	 * generate a bunch of maze
	 * - dig new nodes, locked with stage requirements
	 * - randomly dig/branch/loop
	 * pick node farthest from start of stage
	 * place item
	 */
	public generate2():Maze {
		this.init("generate2");
		let stageStartNode = this.createStartNode();
		const stages:{require:KeySet, provide:string}[] = [];
		/*
		[]
			{require: {}, provide:ITEMCLASS_BLUEKEY},
			{require: {[ITEMCLASS_BLUEKEY]:true}, provide:ITEMCLASS_YELLOWKEY},
			{require: {[ITEMCLASS_YELLOWKEY]:true}, provide:ITEMCLASS_REDKEY},
			{require: {[ITEMCLASS_BLUEKEY]:true,[ITEMCLASS_YELLOWKEY]:true,[ITEMCLASS_REDKEY]:true}, provide:ITEMCLASS_END},
		]
		*/
		let stageReqs:KeySet = {};
		let allKeys:KeySet = {};
		for( let r in this.requireKeys ) {
			const keyClass = this.requireKeys[r];
			allKeys[keyClass] = true;
			stages.push({require:stageReqs, provide:keyClass});
			// Usually require that key for the next stage, but not always
			if( Math.random() < 0.75 ) stageReqs = {[keyClass]:true};
		}
		stages.push({require:allKeys, provide:ITEMCLASS_END});
		
		const newNodesPerStage = (this.targetNodeCount-1) / stages.length;
		const budsPerStage = Math.ceil(newNodesPerStage/2);
		const pathsPerStage = newNodesPerStage-budsPerStage;
		const maxComplictificationsPerStage = Math.ceil(pathsPerStage*this.complectificationFactor);
		for( let s in stages ) {
			const stage = stages[s];
			
			const stageStart = this.nodes.length;
			const stageEndTarget = stageStart + newNodesPerStage;
			const stageBuds:MazeNode[] = [];
			for( let i=0; i<budsPerStage; ++i ) {
				const n = this._selectedNode = bestFit(this.nodes, (n:MazeNode) => Math.random() + 1/(1+n.linkIds.length), "bud node");
				stageBuds.push(this.dig({
					allowsForwardMovement: true,
					allowsBackwardMovement: true,
					locks: difference(stage.require, n.requiredKeys),
				}));
			}
			
			let complectificationCount = 0;
			complectifications: while(
				this.nodes.length < stageEndTarget &&
				complectificationCount < maxComplictificationsPerStage
			) {
				const node = this.randomNode(this.nodes.slice(stageStart));
				if( node.linkIds.length < 3 ) {
					++complectificationCount;
					this._selectedNode = node;
					const v = Math.random();
					
					if( v < 0.5 && this.nodes.length > 4 ) {
						let rando:MazeNode;
						try {
							rando = this.randomNode( this.nodes, (n:MazeNode) => 1/(1+n.linkIds.length) );
						} catch( err) {
							continue complectifications;
						}
						if( Math.random() < 0.5 ) {
							this.linkNodes(node, rando, {
								allowsForwardMovement: true,
								allowsBackwardMovement: true,
								locks: symmetricDifference(node.requiredKeys, rando.requiredKeys),
							});
						} else {
							this.linkNodes(node, rando, {
								allowsForwardMovement: true,
								allowsBackwardMovement: false,
								locks: {},
							});
						}
						continue complectifications;
					}
					
					const pathLen = Math.min(stageEndTarget-this.nodes.length,randInt(1,3));
					this.digSomeKindOfPath(pathLen, difference(stage.require, node.requiredKeys));
				}
			}
			
			this.calculateNodeDistances(stageStartNode);
			const stagePreEndNode = this._selectedNode = bestFit(this.nodes, (n:MazeNode) => Math.random() + n.distanceValue + n.id*4/this.nodes.length);
			const stageEndNode = this.dig({
				allowsForwardMovement: true,
				allowsBackwardMovement: true,
				locks: difference(stage.require, stagePreEndNode.requiredKeys)
			});
			this.placeItem(stage.provide);
			
			// set up for next stage...
			stageStartNode = stageEndNode;
		}
		return this.maze;
	}
	
	public generate1():Maze {
		this.init("generate1");
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
	
	public generate():Maze { return this.generate2(); }
	
	public get maze():Maze {
		return {
			nodes: this.nodes,
			links: this.links,
			generatorName: this.generatorName,
		};
	}
}

if( typeof require != 'undefined' && typeof module != 'undefined' && require.main === module ) {
	const generator = new MazeGenerator();
	generator.requireKeys = [ITEMCLASS_BLUEKEY];
	const maze = generator.generate();
	console.log(JSON.stringify(maze, null, "\t"));
}
