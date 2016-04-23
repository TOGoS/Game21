export default class Cuboid {
	constructor(
		public minX:number, public minY:number, public minZ:number,
		public maxX:number, public maxY:number, public maxZ:number
	) { }
	
	public get width():number  { return this.maxX - this.minX; }
	public get height():number { return this.maxY - this.minY; }
	public get depth():number  { return this.maxZ - this.minZ; }
};
