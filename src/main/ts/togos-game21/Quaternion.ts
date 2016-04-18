import Vector3D from './Vector3D'
import DeepFreezer from './DeepFreezer';

export default class Quaternion {
	public constructor(public a:number=1, public b:number=0, public c:number=0, public d:number=0) { }
	
	public set(a:number, b:number, c:number, d:number) : Quaternion {
		this.a = a; this.b = b; this.c = c; this.d = d;
		return this;
	}
	
	public static IDENTITY = DeepFreezer.deepFreeze(new Quaternion(1,0,0,0));
	
	public normalize():Quaternion {
		return Quaternion.normalize(this);
	}
	
	/**
	 * Assumes x, y, z is normalized!
	 */
	public static fromXYZAxisAngle( x:number, y:number, z:number, angle:number, dest:Quaternion=new Quaternion(0,0,0,0) ):Quaternion {
		// https://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation
		const s = Math.sin(angle/2);
		return dest.set(
			Math.cos(angle/2),
			s*x, s*y, s*z
		);
	}
	
	public static fromAxisAngle( v:Vector3D, angle:number, dest:Quaternion=new Quaternion ):Quaternion {
		return this.fromXYZAxisAngle(v.x, v.y, v.z, angle, dest);
	}
	
	public static multiply( q0:Quaternion, q1:Quaternion, dest:Quaternion=new Quaternion ):Quaternion {
		dest.set(
			q0.a*q1.a - q0.b*q1.b - q0.c*q1.c - q0.d*q1.d,
			q0.a*q1.a + q0.b*q1.a + q0.c*q1.d - q0.d*q1.c,
			q0.a*q1.c - q0.b*q1.d + q0.c*q1.a + q0.d*q1.a,
			q0.a*q1.d + q0.b*q1.c - q0.c*q1.a + q0.d*q1.a
		);
		return dest;
	}
	
	public static dotProduct(q0:Quaternion, q1:Quaternion):number {
		return q0.a*q1.a + q0.b*q1.b + q0.c*q1.c + q0.d*q1.d;
	}
	
	public static normalize(q:Quaternion, dest:Quaternion=new Quaternion):Quaternion {
		const len = Math.sqrt(q.a*q.a + q.b*q.b + q.c*q.c + q.d*q.d);
		if( len == 0 ) dest.set(q.a, q.b, q.c, q.d);
		dest.set(q.a/len, q.b/len, q.c/len, q.d/len);
		return dest;
	}
	
	public static random() {
		const q:Quaternion = new Quaternion(Math.random(), Math.random(), Math.random(), Math.random());
		this.normalize(q,q);
		return q;
	}
	
	// based on this guy's code:
	// https://github.com/Kent-H/blue3D/blob/master/Blue3D/src/blue3D/type/QuaternionF.java
	public static slerp( q0:Quaternion, q1:Quaternion, t:number, allowFlip:boolean, dest:Quaternion):Quaternion {
		// Warning: this method should not normalize the Quaternion
		const cosAngle:number = this.dotProduct(q0, q1);
    	
		let c1, c2;
		// Linear interpolation for close orientations
		if( (1.0 - Math.abs(cosAngle)) < 0.01 ) {
			c1 = 1.0 - t;
			c2 = t;
		} else {
			// Spherical interpolation
			const angle = Math.acos(Math.abs(cosAngle));
			const sinAngle = Math.sin(angle);
			c1 = (Math.sin(angle * (1.0 - t)) / sinAngle);
			c2 = (Math.sin(angle * t) / sinAngle);
		}
		
		// Use the shortest path
		if( allowFlip && (cosAngle < 0.0) ) c1 = -c1;
		
		dest.a = c1 * q0.a + c2 * q1.a;
		dest.b = c1 * q0.b + c2 * q1.b;
		dest.c = c1 * q0.c + c2 * q1.c;
		dest.d = c1 * q0.d + c2 * q1.d;
		
		return dest;
	}
	
	public static areEqual(q0:Quaternion, q1:Quaternion):boolean {
		return q0.a === q1.a && q0.b === q1.b && q0.c === q1.c && q0.d === q1.d;
	}
}
