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
	
	public containsVector( v:Vector3D ):boolean {
		if( v.x < this.minX ) return false;
		if( v.y < this.minY ) return false;
		if( v.z < this.minZ ) return false;
		if( v.x > this.maxX ) return false;
		if( v.y > this.maxY ) return false;
		if( v.z > this.maxZ ) return false;
		return true;
	}
};
