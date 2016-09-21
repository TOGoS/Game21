import Vector3D from './Vector3D';

export default class Cuboid {
	constructor(
		public minX:number=0, public minY:number=0, public minZ:number=0,
		public maxX:number=0, public maxY:number=0, public maxZ:number=0
	) { }
	
	public get width():number  { return this.maxX - this.minX; }
	public get height():number { return this.maxY - this.minY; }
	public get depth():number  { return this.maxZ - this.minZ; }
	
	//get isPositiveSize():boolean { return this.width > 0 && this.height > 0 && this.depth > 0; }
	
	public static intersection( c0:Cuboid, c1:Cuboid, dest:Cuboid=new Cuboid ):Cuboid {
		dest.minX = Math.max(c0.minX, c1.minX);
		dest.minY = Math.max(c0.minY, c1.minY);
		dest.minZ = Math.max(c0.minZ, c1.minZ);
		dest.maxX = Math.min(c0.maxX, c1.maxX);
		dest.maxY = Math.min(c0.maxY, c1.maxY);
		dest.maxZ = Math.min(c0.maxZ, c1.maxZ);
		return dest;
	}
	
	public static containsVector( cuboid:Cuboid, v:Vector3D ):boolean {
		if( v.x < cuboid.minX ) return false;
		if( v.y < cuboid.minY ) return false;
		if( v.z < cuboid.minZ ) return false;
		if( v.x > cuboid.maxX ) return false;
		if( v.y > cuboid.maxY ) return false;
		if( v.z > cuboid.maxZ ) return false;
		return true;
	}

	public static intersectsWithOffset( aPos:Vector3D, aBb:Cuboid, bPos:Vector3D, bBb:Cuboid ):boolean {
		if( aPos.x + aBb.maxX <= bPos.x + bBb.minX ) return false;
		if( aPos.x + aBb.minX >= bPos.x + bBb.maxX ) return false;
		if( aPos.y + aBb.maxY <= bPos.y + bBb.minY ) return false;
		if( aPos.y + aBb.minY >= bPos.y + bBb.maxY ) return false;
		if( aPos.z + aBb.maxZ <= bPos.z + bBb.minZ ) return false;
		if( aPos.z + aBb.minZ >= bPos.z + bBb.maxZ ) return false;
		return true;
	}
	
	public containsVector( v:Vector3D ):boolean {
		return Cuboid.containsVector( this, v );
	}
};

export function makeCuboid(minX:number, minY:number=0, minZ:number=0, maxX:number=0, maxY:number=0, maxZ:number=0) {
	return new Cuboid(minX, minY, minZ, maxX, maxY, maxZ);
}
export function cuboidWidth(cuboid:Cuboid) {
	return cuboid.maxX - cuboid.minX;
}
export function cuboidHeight(cuboid:Cuboid) {
	return cuboid.maxY - cuboid.minY;
}
export function cuboidDepth(cuboid:Cuboid) {
	return cuboid.maxZ - cuboid.minZ;
}
