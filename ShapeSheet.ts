import Rectangle from './Rectangle';

export default class {
	// Treat these all as read-only
	public width:number;
	public height:number;
	public cellMaterialIndexes:Uint16Array;
	public cellCornerDepths:Float32Array;
	// The rest of this really belongs in renderer.
	public cellCoverages:Uint8Array;
	public cellAverageDepths:Float32Array;
	public cellNormals:Float32Array;
	public cellColors:Float32Array;
	
	public minimumAverageDepth:number;
	
	get bounds():Rectangle {
		return new Rectangle(0, 0, this.width, this.height).assertIntegerBoundaries();
	}
	
	constructor(width:number, height:number) {
		this.width = width|0;
		this.height = height|0;
		const cellCount:number = (width*height)|0;
		this.cellMaterialIndexes = new Uint16Array(cellCount);
		this.cellCornerDepths    = new Float32Array(cellCount*4); // Depth (in pixels) of each corner
		this.cellCoverages       = new Uint8Array(cellCount); // coverage based on depth; 0,1,2,3,4 (divide by 4.0 to get opacity factor)
		this.cellAverageDepths   = new Float32Array(cellCount);
		this.cellNormals         = new Float32Array(cellCount*3); // normal vector X,Y,Z
		this.cellColors          = new Float32Array(cellCount*4); // r,g,b,a of each cell after shading
		this.initBuffer();
	}
	
	public initBuffer() {
		// Primary shape data
		this.cellCornerDepths.fill(Infinity);
		// calculated by calculateCellDepthDerivedData based on cellCornerDepths
		// (this stuff is only used by renderer; maybe it should live there):
		this.cellCoverages.fill(0);
		this.minimumAverageDepth = Infinity;
		this.cellAverageDepths.fill(Infinity);
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
			],
			averageDepth: this.cellAverageDepths[idx],
			color: [
				this.cellColors[idx*4+0],
				this.cellColors[idx*4+1],
				this.cellColors[idx*4+2],
				this.cellColors[idx*4+3]
			]
		};
	};
}
