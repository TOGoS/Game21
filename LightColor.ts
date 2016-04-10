import DeepFreezer from './DeepFreezer';

class LightColor {
	constructor(public r:number, public g:number, public b:number) {
		DeepFreezer.freeze(this, true); // We're immutable yeahh!
	}
	
	scale(scale:number):LightColor {
		if( scale == 1 ) return this;
		return new LightColor(this.r*scale, this.g*scale, this.b*scale);
	}
	
	public static createFrom(thing:any):LightColor {
		let r=null, g=null, b=null;
		if( thing instanceof Array ) {
			r = thing[0]; g = thing[1]; b = thing[2];
		} else {
			r = thing.r; g = thing.r; b = thing.b;
		}
		
		let errors = [];
		if( typeof r != 'number' ) errors.push("'r' must be a number; got "+JSON.stringify(r));
		if( typeof g != 'number' ) errors.push("'g' must be a number; got "+JSON.stringify(g));
		if( typeof b != 'number' ) errors.push("'b' must be a number; got "+JSON.stringify(b));
		if( errors.length > 0 ) {
			throw new Error("Error creating LightColor from "+JSON.stringify(thing)+":\n"+errors.join("\n"));
		}
		
		return new LightColor(r,g,b);
	}
	
	public static from(thing:any):LightColor {
		if( thing instanceof LightColor ) return thing;
		return this.createFrom(thing);
	}
}

export default LightColor;
