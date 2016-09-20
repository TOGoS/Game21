import { deepFreeze } from './DeepFreezer';

const roundToNearestMultiple = function(n:number, gridSize:number):number {
	return Math.round(n/gridSize) * gridSize;
}

export interface Vector3DLike {
	x : number;
	y : number;
	z : number;
}

export default class Vector3D implements Vector3DLike {
	constructor(public x:number=0, public y:number=0, public z:number=0) { }
	
	public static isZero( vec:Vector3DLike ):boolean {
		return vec.x == 0 && vec.y == 0 && vec.z == 0;
	}
	public static vectorLength( vec:Vector3DLike ):number {
		return Math.sqrt(vec.x*vec.x + vec.y*vec.y + vec.z*vec.z);
	}
	
	get isZero():boolean { return this.x == 0 && this.y == 0 && this.z == 0; }
	
	get length():number { return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z); }
	
	public static ZERO = deepFreeze(new Vector3D(0,0,0));
	public static I    = deepFreeze(new Vector3D(1,0,0));
	public static J    = deepFreeze(new Vector3D(0,1,0));
	public static K    = deepFreeze(new Vector3D(0,0,1));
	
	// Can be used as a temporary vector in innermost functions
	// when you know nobody else will be messing with it between
	// when you set it and need the value later!
	public static temp0 = new Vector3D;
	
	public set(x:number, y:number, z:number):Vector3D {
		this.x = x; this.y = y; this.z = z;
		return this;
	}
	
	public clear():void {
		this.set(0,0,0);
	}
	
	public scale(scale:number, dest?:Vector3D):Vector3D {
		if( scale == 1 && dest == null ) return this;
		if( dest == null ) dest = new Vector3D;
		return dest.set(this.x*scale, this.y*scale, this.z*scale);
	}
	
	public static normalize(vec:Vector3DLike, targetLength:number=1, dest?:Vector3D):Vector3D {
		const length = Vector3D.vectorLength(vec);
		const scale = length == 0 ? 1 : targetLength/length;
		return Vector3D.scale( vec, scale, dest );
	}
	
	public normalize(targetLength:number=1, dest?:Vector3D):Vector3D {
		const scale = this.length == 0 ? 1 : targetLength/this.length;
		return this.scale( scale, dest );
	}
	
	public toArray():Array<number> {
		return [this.x, this.y, this.z];
	}
	
	public static accumulate( v0:Vector3D, dest:Vector3D, scale:number=1 ):Vector3D {
		dest.x += v0.x*scale;
		dest.y += v0.y*scale;
		dest.z += v0.z*scale;
		return dest;
	}
	public static add( v0:Vector3D, v1:Vector3D, dest:Vector3D=new Vector3D ):Vector3D {
		return dest.set(v0.x+v1.x, v0.y+v1.y, v0.z+v1.z);
	}
	public static scale(v:Vector3DLike, n:number, dest:Vector3D=new Vector3D):Vector3D {
		dest.set(v.x*n, v.y*n, v.z*n);
		return dest;
	}
	public static subtract( v0:Vector3D, v1:Vector3D ):Vector3D {
		return new Vector3D(v0.x-v1.x, v0.y-v1.y, v0.z-v1.z);
	}
	
	public static differenceMagnitude( v0:Vector3D, v1:Vector3D ):number {
		// return subtract(v0,v1).length
		const dx=v0.x-v1.x, dy=v0.y-v1.y, dz=v0.z-v1.z;
		return Math.sqrt(dx*dx + dy*dy + dz*dz);
	}
	
	public static roundToGrid(vec:Vector3DLike, xGrid:number=1, yGrid:number=xGrid, zGrid:number=xGrid, dest:Vector3D=new Vector3D) : Vector3D {
		return dest.set(
			roundToNearestMultiple(vec.x, xGrid),
			roundToNearestMultiple(vec.y, yGrid),
			roundToNearestMultiple(vec.z, zGrid)
		);
	}
	public roundToGrid(xGrid:number=1, yGrid:number=xGrid, zGrid:number=xGrid, dest:Vector3D=new Vector3D) : Vector3D {
		return Vector3D.roundToGrid(this, xGrid, yGrid, zGrid, dest);
	}
	
	public static dotProduct(v0:Vector3D, v1:Vector3D):number {
		return v0.x*v1.x + v0.y*v1.y + v0.z*v1.z;
	}
	
	public static createFrom(thing:any):Vector3D {
		let x:any=null, y:any=null, z:any=null;
		if( thing instanceof Array ) {
			x = thing[0]; y = thing[1]; z = thing[2];
		} else {
			x = thing.x; y = thing.y; z = thing.z;
		}
		
		let errors:string[] = [];
		if( typeof x != 'number' ) errors.push("'x' must be a number; got "+JSON.stringify(x));
		if( typeof y != 'number' ) errors.push("'y' must be a number; got "+JSON.stringify(y));
		if( typeof z != 'number' ) errors.push("'z' must be a number; got "+JSON.stringify(z));
		if( errors.length > 0 ) {
			throw new Error("Errors while trying to interpret "+JSON.stringify(thing)+" as Vector3D:\n"+errors.join("\n"));
		}
		
		return new Vector3D( x, y, z );
	}
	
	public static from(thing:any):Vector3D {
		if( thing instanceof Vector3D ) return thing;
		return this.createFrom(thing);
	}
}
