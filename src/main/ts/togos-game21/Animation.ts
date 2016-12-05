export enum AnimationTypeID {
	NONE    = 0, // Not animated!
	ONCE    = 1, // Triggered by some event, goes to end and then stops
	LOOP    = 2, // Plays 0-1, 0-1, over and over
	REVERSE = 3, // Plays from 0-1, then 1-0, 0-1, etc
}

export function animationTypeIdToName( id:AnimationTypeID ):string {
	const name = AnimationTypeID[id];
	if( name === null ) throw new Error("Invalid AnimationType: "+id);
	return name.toLowerCase();
}
export function animationTypeFromName( name:string ):AnimationTypeID {
	return <AnimationTypeID>(<any>AnimationTypeID)[name.toUpperCase()];
}

export default class Animation<FrameType> {
	/**
	 * Number of time units (usually seconds) the animation should last.
	 * Should be Infinity for non-animations.
	 */
	public length:number;
	/**
	 * Should the animation loop or stop when finished? 
	 **/
	public type:AnimationTypeID;
	/**
	 * How to draw the frames.
	 */
	public frames:Array<FrameType>;
}
