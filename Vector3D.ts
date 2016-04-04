import DeepFreezer from './DeepFreezer';

export default class Vector3D {
	constructor(public x:number, public y:number, public z:number, mutable:boolean=false) {
		if( !mutable ) DeepFreezer.freeze(this, true);
	}
	
	public static makeBuffer() {
		return new Vector3D(0,0,0,true);
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

export class Vector3DBuffer {
	constructor(public x:number, public y:number, public z:number) { }
	public set(x:number, y:number, z:number):void {
		this.x = x; this.y = y; this.z = z;
	}
	public clear():void {
		this.set(0,0,0);
	}
	public toVector():Vector3D {
		return new Vector3D(this.x, this.y, this.z);
	}
}
