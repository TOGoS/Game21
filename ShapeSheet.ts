import Rectangle from './Rectangle';

export default class {
	// Treat these all as read-only
	public width:number;
	public height:number;
	public cellMaterialIndexes:Uint16Array;
	public cellCornerDepths:Float32Array;
	
	public get bounds():Rectangle {
		return new Rectangle(0, 0, this.width, this.height).assertIntegerBoundaries();
	}
	
	public get area():number {
		return this.width*this.height;
	}
	
	constructor(width:number, height:number) {
		this.width = width|0;
		this.height = height|0;
		const cellCount:number = (width*height)|0;
		this.cellMaterialIndexes = new Uint16Array(cellCount);
		this.cellCornerDepths    = new Float32Array(cellCount*4); // Depth (in pixels) of each corner
		this.initBuffer();
	}
	
	public initBuffer() {
		// Primary shape data
		this.cellMaterialIndexes.fill(0);
		this.cellCornerDepths.fill(Infinity);
		// calculated by calculateCellDepthDerivedData based on cellCornerDepths
		// (this stuff is only used by renderer; maybe it should live there):
		// calculated by calculateCellColors based on the above:
		
		//this.canvasUpdateRequested = false;
	}
	
	getCellInfo(x:number, y?:number) {
		const idx = y == null ? (x|0) : (y|0)*this.width + (x|0);
		if( idx < 0 || idx >= this.width*this.height ) return null;
		return {
			materialIndex: this.cellMaterialIndexes[idx],
			cornerDepths: [
				this.cellCornerDepths[idx*4+0],
				this.cellCornerDepths[idx*4+1],
				this.cellCornerDepths[idx*4+2],
				this.cellCornerDepths[idx*4+3]
			]
		};
	};
}
