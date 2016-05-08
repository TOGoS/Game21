export interface RectangularBounds {
	minX:number;
	minY:number;
	maxX:number;
	maxY:number;
}

export default class Rectangle implements RectangularBounds {
	constructor(public minX:number=0, public minY:number=0, public maxX:number=0, public maxY:number=0) { }
	
	public set(minX:number, minY:number, maxX:number, maxY:number) {
		this.minX = minX; this.minY = minY;
		this.maxX = maxX; this.maxY = maxY;
	}
	
	get width():number { return this.maxX-this.minX; }
	get height():number { return this.maxY-this.minY; }
	get area():number { return this.width < 0 || this.height < 0 ? 0 : this.width*this.height; }
	get isPositiveSize():boolean { return this.width > 0 && this.height > 0; }
	
	public toNonNegativeRectangle():Rectangle {
		if( this.width >= 0 && this.height >= 0 ) return this;
		
		let minX = this.minX, minY = this.minY, maxX = this.maxX, maxY = this.maxY;
		if( minX > maxX ) minX = maxX = 0;
		if( minY > maxY ) minY = maxY = 0;
		return new Rectangle(minX, minY, maxX, maxY);
	}
	
	public grow(minX:number, minY:number=minX, maxX:number=minX, maxY:number=minY) {
		if( minX < 0 ) throw new Error("Grow shouldn't be < 0!");
		return new Rectangle(this.minX - minX, this.minY - minX, this.maxX + minX, this.maxY + minX );
		//return new Rectangle(this.minX - minX, this.minY - minY, this.maxX + maxX, this.maxY + maxY );
	}
	
	public growToIntegerBoundaries():Rectangle {
		return new Rectangle(Math.floor(this.minX), Math.floor(this.minY), Math.ceil(this.maxX), Math.ceil(this.maxY));
	}
	
	public assertIntegerBoundaries():Rectangle {
		if( this.minX !== (this.minX|0) ) throw new Error("MinX not an integer: "+this.minX);
		if( this.minY !== (this.minY|0) ) throw new Error("MinY not an integer: "+this.minY);
		if( this.maxX !== (this.maxX|0) ) throw new Error("MinX not an integer: "+this.maxX);
		if( this.maxY !== (this.maxY|0) ) throw new Error("MinX not an integer: "+this.maxY);
		return this;
	}
	
	public static intersection(r0:Rectangle, r1:Rectangle) {
		return new Rectangle(
			Math.max(r0.minX, r1.minX),
			Math.max(r0.minY, r1.minY),
			Math.min(r0.maxX, r1.maxX),
			Math.min(r0.maxY, r1.maxY)
		);
	}
	
	public static union(r0:Rectangle, r1:Rectangle) {
		return new Rectangle(
			Math.min(r0.minX, r1.minX),
			Math.min(r0.minY, r1.minY),
			Math.max(r0.maxX, r1.maxX),
			Math.max(r0.maxY, r1.maxY)
		);
	}
	
	public static areEqual(r0:Rectangle, r1:Rectangle):boolean {
		return r0.minX == r1.minX && r0.minY == r1.minY && r0.maxX == r1.maxX && r0.maxY == r1.maxY;
	}
}
