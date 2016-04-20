import { deepFreeze } from './DeepFreezer';

class SurfaceColor {
	constructor(public r:number, public g:number, public b:number, public a:number=1) { }
	
	public static NONE:SurfaceColor = deepFreeze(new SurfaceColor(0,0,0,0));
}

export default SurfaceColor;
