import KeyedList from './KeyedList';

export type KeySet = KeyedList<boolean>;

export const ITEMCLASS_START = 'start';
export const ITEMCLASS_END = 'end';
export const ITEMCLASS_BLUEKEY = 'blueKey';
export const ITEMCLASS_YELLOWKEY = 'yellowKey';
export const ITEMCLASS_REDKEY = 'redKey';

export interface MazeLinkAttributes {
	locks : KeySet
	allowsForwardMovement : boolean;
	allowsBackwardMovement : boolean;
	
	direction? : number;
}

export const DEFAULT_LINK_ATTRIBUTES:MazeLinkAttributes = {
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

export interface MazeNode {
	id : number;
	linkIds : number[];
	requiredKeys : KeySet;
	items : KeyedList<string>;
	distanceValue? : number;
}

export interface Maze {
	nodes : MazeNode[];
	links : MazeLink[];
	generatorName? : string;
}
