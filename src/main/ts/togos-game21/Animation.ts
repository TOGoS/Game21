export enum OnAnimationEnd {
	STOP,
	LOOP
}

export default class Animation<FrameType> {
	static ONEND_STOP = 0;
	static ONEND_LOOP = 1;
	
	/**
	 * Number of time units (usually seconds) the animation should last.
	 * Should be Infinity for non-animations.
	 */
	public length:number;
	/**
	 * Should the animation loop or stop when finished? 
	 **/ 
	public onEnd:OnAnimationEnd;
	/**
	 * How to draw the frames.
	 */
	public frames:Array<FrameType>;
}
