export default class Animation<FrameType> {
	static ONEND_STOP = 0;
	static ONEND_LOOP = 1;
	
	public speed:number; // frames per second, let's say
	public onEnd:number; // how it acts when it's done
	public frames:Array<FrameType>; // Which slice to show for each frame
}
