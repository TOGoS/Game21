import DeepFreezer from './DeepFreezer';

class Vector3D {
	constructor(public x:number, public y:number, public z:number) {
		DeepFreezer.freeze(this, true); // We're immutable yeahh!
	}
	
	get length():number { return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z); }
	
	scale(scale:number):Vector3D {
		if( scale == 1 ) return this;
		return new Vector3D(this.x*scale, this.y*scale, this.z*scale);
	}
	
	normalize():Vector3D {
		return this.scale( 1/this.length );
	}
}

export default Vector3D;
