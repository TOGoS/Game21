export enum OnAnimationEnd {
	STOP,
	LOOP
}

export default class Animation<FrameType> {
	static ONEND_STOP = 0;
	static ONEND_LOOP = 1;
	
	/**
	 * Number of times the entire animation loops (t from 0 to 1) per second.
	 * For non-animated things, this should be 0.
	 */
	public speed:number;
	/**
	 * Should the animation loop or stop when finished? 
	 **/ 
	public onEnd:OnAnimationEnd;
	/**
	 * How to draw the frames.
	 */
	public frames:Array<FrameType>;
}
