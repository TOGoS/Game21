import DeepFreezer from './DeepFreezer';

class LightColor {
	constructor(public r:number, public g:number, public b:number) {
		DeepFreezer.freeze(this, true); // We're immutable yeahh!
	}
	
	scale(scale:number):LightColor {
		if( scale == 1 ) return this;
		return new LightColor(this.r*scale, this.g*scale, this.b*scale);
	}
}

export default LightColor;
