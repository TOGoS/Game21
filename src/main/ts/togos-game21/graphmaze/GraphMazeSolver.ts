/// <reference path="../../node.d.ts"/>
/// <reference path="../../Promise.d.ts"/>

import KeyedList from '../KeyedList';
import { union } from './setutil';
import {
	MazeNode,
	MazeLink,
	MazeLinkAttributes,
	DEFAULT_LINK_ATTRIBUTES,
	KeySet,
	Maze,
	ITEMCLASS_START,
	ITEMCLASS_END,
} from '../graphmaze';

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

export default class MazeSolver {
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
	const readStream = ( s:NodeJS.ReadableStream ):Promise<string[]> => {
		return new Promise( (resolve,reject) => {
			const parts:string[] = [];
			s.on('data', (dat:string) => parts.push(dat));
			s.on('end', () => resolve(parts) );
			s.on('error', (err:any) => reject(err) );
			s.read();
		});
	}

	readStream(process.stdin).then( (parts) => {
		const maze:Maze = JSON.parse(parts.join(""));
		const solver = new MazeSolver(maze);
		solver.solve();
		solver.assertGoodMaze();
		solver.replaySolution(solver.shortestSolution!, {
			at(playerState:MazePlayerState) {
				console.log(playerStateId(playerState));
			},
			passed(linkNumber:number, link:MazeLink) {
				const lockStrs:string[] = [];
				for( let k in link.locks ) lockStrs.push(k);
				console.log( "Take link "+linkNumber+(lockStrs.length == 0 ? "" : " locked by "+lockStrs.join(',')));
			}
		});
	});
}