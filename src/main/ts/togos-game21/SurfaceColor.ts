import { deepFreeze } from './DeepFreezer';

class SurfaceColor {
	constructor(public r:number, public g:number, public b:number, public a:number=1) { }
	
	public static NONE:SurfaceColor = deepFreeze(new SurfaceColor(0,0,0,0));
	
	public toRgbaString():string {
		return 'rgba('+Math.round(this.r*256)+','+Math.round(this.g*256)+','+Math.round(this.b*256)+','+this.a+')';
	}
}

export default SurfaceColor;
