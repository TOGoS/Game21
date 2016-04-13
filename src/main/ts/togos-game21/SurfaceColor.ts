import DeepFreezer from './DeepFreezer';

class SurfaceColor {
	constructor(public r:number, public g:number, public b:number, public a:number=1) {
		DeepFreezer.freeze(this, true); // We're immutable yeahh!
	}
	
	public static NONE:SurfaceColor = DeepFreezer.deepFreeze(new SurfaceColor(0,0,0,0));
}

export default SurfaceColor;
