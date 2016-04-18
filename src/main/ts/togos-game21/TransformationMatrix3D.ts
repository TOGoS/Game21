import DeepFreezer from './DeepFreezer';
import Vector3D from './Vector3D';
import Quaternion from './Quaternion';

const fmtNum = function(num:number, size:number, digits=2) {
	var s = num.toPrecision(digits);
	while( s.length < size ) s = " "+s;
	return s;
}

/**
 * Acts as a 4D matrix, but only storing the first 3 rows.
 * The last row is assumed to be [0,0,0,1]
 */
export default class TransformationMatrix3D {
	public constructor(
		public xx:number=0, public xy:number=0, public xz:number=0, public x1:number=0, 
		public yx:number=0, public yy:number=0, public yz:number=0, public y1:number=0,
		public zx:number=0, public zy:number=0, public zz:number=0, public z1:number=0
	) { }
	
	public get scale():number {
		const xScale = Math.sqrt(this.xx*this.xx + this.yx*this.yx + this.zx*this.zx);
		const yScale = Math.sqrt(this.xy*this.xy + this.yy*this.yy + this.zy*this.zy);
		const zScale = Math.sqrt(this.xz*this.xz + this.yz*this.yz + this.zz*this.zz);
		return (xScale + yScale + zScale) / 3;
	}
	
	public get hasRotation():boolean {
		return this.xy != 0 || this.xz != 0 || this.yx != 0 || this.yz != 0 || this.zx != 0 || this.zy != 0;
	}
	public get hasTranslation():boolean {
		return this.x1 != 0 || this.y1 != 0 || this.z1 != 0;
	}
	
	public set(
		xx:number, xy:number, xz:number, x1:number,
		yx:number, yy:number, yz:number, y1:number,
		zx:number, zy:number, zz:number, z1:number
	):TransformationMatrix3D {
		this.xx = xx; this.xy = xy; this.xz = xz; this.x1 = x1;
		this.yx = yx; this.yy = yy; this.yz = yz; this.y1 = y1;
		this.zx = zx; this.zy = zy; this.zz = zz; this.z1 = z1;
		return this;
	}
	
	public get "1x"() { return 0; }
	public get "1y"() { return 0; }
	public get "1z"() { return 0; }
	public get "11"() { return 1; }
		
	public static IDENTITY = DeepFreezer.deepFreeze(new TransformationMatrix3D(1,0,0,0,0,1,0,0,0,0,1,0));
	
	public multiplyVector( v:Vector3D, dest:Vector3D=new Vector3D ) : Vector3D {
		return dest.set(
			this.xx*v.x + this.xy*v.y + this.xz * v.z + this.x1,
			this.yx*v.x + this.yy*v.y + this.yz * v.z + this.y1,
			this.zx*v.x + this.zy*v.y + this.zz * v.z + this.z1
		);
	}
	
	public static scale( sx:number, sy:number=sx, sz:number=sx, dest:TransformationMatrix3D=new TransformationMatrix3D ):TransformationMatrix3D {
		return dest.set(
			sx, 0, 0, 0,
			0, sy, 0, 0,
			0, 0, sz, 0
		);
	}
	
	public static translation( xlt:Vector3D, dest:TransformationMatrix3D=new TransformationMatrix3D ):TransformationMatrix3D {
		return dest.set(
			1, 0, 0, xlt.x,
			0, 1, 0, xlt.y,
			0, 0, 1, xlt.z
		//	0, 0, 0, 1      // Implied bottom row
		);
	};
	
	public static multiply( m1:TransformationMatrix3D, m2:TransformationMatrix3D, dest:TransformationMatrix3D=new TransformationMatrix3D ):TransformationMatrix3D {
		dest.xx = m1.xx * m2.xx + m1.xy * m2.yx + m1.xz * m2.zx + 0;
		dest.xy = m1.xx * m2.xy + m1.xy * m2.yy + m1.xz * m2.zy + 0;
		dest.xz = m1.xx * m2.xz + m1.xy * m2.yz + m1.xz * m2.zz + 0;
		dest.x1 = m1.xx * m2.x1 + m1.xy * m2.y1 + m1.xz * m2.z1 + m1.x1;
		dest.yx = m1.yx * m2.xx + m1.yy * m2.yx + m1.yz * m2.zx + 0;
		dest.yy = m1.yx * m2.xy + m1.yy * m2.yy + m1.yz * m2.zy + 0;
		dest.yz = m1.yx * m2.xz + m1.yy * m2.yz + m1.yz * m2.zz + 0;
		dest.y1 = m1.yx * m2.x1 + m1.yy * m2.y1 + m1.yz * m2.z1 + m1.y1;
		dest.zx = m1.zx * m2.xx + m1.zy * m2.yx + m1.zz * m2.zx + 0;
		dest.zy = m1.zx * m2.xy + m1.zy * m2.yy + m1.zz * m2.zy + 0;
		dest.zz = m1.zx * m2.xz + m1.zy * m2.yz + m1.zz * m2.zz + 0;
		dest.z1 = m1.zx * m2.x1 + m1.zy * m2.y1 + m1.zz * m2.z1 + m1.z1;
		return dest;
	}
	
	public multiply( r:TransformationMatrix3D, dest:TransformationMatrix3D=new TransformationMatrix3D ):TransformationMatrix3D {
		return TransformationMatrix3D.multiply(this, r, dest);
	}
	
	/**
	 * Assumes axis vector (x,y,z) is already normalized
	 */
	public static fromXYZAxisAngle( x:number, y:number, z:number, angle:number, dest:TransformationMatrix3D=new TransformationMatrix3D() ):TransformationMatrix3D {
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		const t = 1-c;
		// http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToMatrix/
		return dest.set(
			t*x*x + c  , t*x*y - z*s, t*x*z + y*s, 0,
			t*x*y + z*s, t*y*y + c  , t*y*z - x*s, 0,
			t*x*z - y*s, t*y*z + x*s, t*z*z + c  , 0
		);
	}
	
	public static fromAxisAngle( axis:Vector3D, angle:number, dest:TransformationMatrix3D=new TransformationMatrix3D() ):TransformationMatrix3D {
		return this.fromXYZAxisAngle(axis.x, axis.y, axis.z, angle, dest);
	}
	
	public static fromQuaternion( q:Quaternion, dest:TransformationMatrix3D=new TransformationMatrix3D() ):TransformationMatrix3D {
		// Symbols defined to match those used on
		// https://en.wikipedia.org/wiki/Quaternions_and_spatial_rotation#Quaternion-derived_rotation_matrix
		const r = q.a, i=q.b, j=q.c, k=q.d;
		const rr = r*r, ii = i*i, jj = j*j, kk = k*k;
		const ij = i*j, ik = i*k, ir = i*r, kr = k*r, jk = j*k, jr = j*r;
		return dest.set(
			1 - 2*(jj + kk),     2*(ij - kr),     2*(ik + jr), 0,
			    2*(ij + kr), 1 - 2*(ii + kk),     2*(jk - ir), 0,
			    2*(ik - jr),     2*(jk + ir), 1 - 2*(ii + jj), 0
		);
	}
	
	public get rows():Array<Array<number>> {
		return [[this.xx, this.xy, this.xz, this.x1], [this.yx, this.yy, this.yz, this.y1], [this.zx, this.zy, this.zz, this.z1], [this["1x"], this["1y"], this["1z"], this["11"]]];
	}
	
	public toString():String {
		return this.rows.map( r => r.map(n => fmtNum(n, 7, 2)).join(" ")).join("\n");
	}
}
