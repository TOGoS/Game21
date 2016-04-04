import DeepFreezer from './DeepFreezer';

class SurfaceColor {
	constructor(public r:number, public g:number, public b:number, public a:number) {
		DeepFreezer.freeze(this, true); // We're immutable yeahh!
	}
	
	public static NONE:SurfaceColor = new SurfaceColor(0,0,0,0);
}

export default SurfaceColor;
