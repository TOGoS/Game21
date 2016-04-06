const roundToNearestMultiple = function(n:number, gridSize:number):number {
	return Math.round(n/gridSize) * gridSize;
}

export default class Vector3D {
	constructor(public x:number=0, public y:number=0, public z:number=0) { }
	
	get length():number { return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z); }

	public set(x:number, y:number, z:number):Vector3D {
		this.x = x; this.y = y; this.z = z;
		return this;
	}
	
	public clear():void {
		this.set(0,0,0);
	}
	
	public scale(scale:number):Vector3D {
		if( scale == 1 ) return this;
		return new Vector3D(this.x*scale, this.y*scale, this.z*scale);
	}
	
	public normalize():Vector3D {
		return this.scale( 1/this.length );
	}
	
	public toArray():Array<number> {
		return [this.x, this.y, this.z];
	}
	
	public roundToGrid(xGrid:number=1, yGrid:number=xGrid, zGrid:number=xGrid, dest:Vector3D=new Vector3D) : Vector3D {
		return dest.set(
			roundToNearestMultiple(this.x, xGrid),
			roundToNearestMultiple(this.y, yGrid),
			roundToNearestMultiple(this.z, zGrid)
		);
	}
}

export type Vector3DBuffer = Vector3D;
