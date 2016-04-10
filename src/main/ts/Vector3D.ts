import DeepFreezer from './DeepFreezer';

const roundToNearestMultiple = function(n:number, gridSize:number):number {
	return Math.round(n/gridSize) * gridSize;
}

export default class Vector3D {
	constructor(public x:number=0, public y:number=0, public z:number=0) { }
	
	get length():number { return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z); }
	
	public static ZERO = DeepFreezer.deepFreeze(new Vector3D(0,0,0));
	public static I    = DeepFreezer.deepFreeze(new Vector3D(1,0,0));
	public static J    = DeepFreezer.deepFreeze(new Vector3D(0,1,0));
	public static K    = DeepFreezer.deepFreeze(new Vector3D(0,0,1));
	
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
	
	public normalize(targetLength:number=1, dest?:Vector3D):Vector3D {
		const scale = this.length == 0 ? 1 : targetLength/this.length;
		return this.scale( scale, dest );
	}
	
	public toArray():Array<number> {
		return [this.x, this.y, this.z];
	}
	
	public static accumulate( v0:Vector3D, dest:Vector3D ):Vector3D {
		dest.x += v0.x;
		dest.y += v0.y;
		dest.z += v0.z;
		return dest;
	}
	public static add( v0:Vector3D, v1:Vector3D ):Vector3D {
		return new Vector3D(v0.x+v1.x, v0.y+v1.y, v0.z+v1.z);
	}
	public static subtract( v0:Vector3D, v1:Vector3D ):Vector3D {
		return new Vector3D(v0.x-v1.x, v0.y-v1.y, v0.z-v1.z);
	}
	
	public static differenceMagnitude( v0:Vector3D, v1:Vector3D ):number {
		// return subtract(v0,v1).length
		const dx=v0.x-v1.x, dy=v0.y-v1.y, dz=v0.z-v1.z;
		return Math.sqrt(dx*dx + dy*dy + dz*dz);
	}
	
	public roundToGrid(xGrid:number=1, yGrid:number=xGrid, zGrid:number=xGrid, dest:Vector3D=new Vector3D) : Vector3D {
		return dest.set(
			roundToNearestMultiple(this.x, xGrid),
			roundToNearestMultiple(this.y, yGrid),
			roundToNearestMultiple(this.z, zGrid)
		);
	}
	
	public static createFrom(thing:any):Vector3D {
		let x=null, y=null, z=null;
		if( thing instanceof Array ) {
			x = thing[0]; y = thing[1]; z = thing[2];
		} else {
			x = thing.x; y = thing.y; z = thing.z;
		}
		
		let errors = [];
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
