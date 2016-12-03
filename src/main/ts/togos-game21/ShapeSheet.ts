import Rectangle from './Rectangle';

export default class ShapeSheet {
	// Treat these all as read-only
	public width:number;
	public height:number;
	public layerCount:number
	protected _bounds:Rectangle;
	public cellMaterialIndexes:Uint16Array;
	/**
	 * Depths of centers of cells, organized into layers.
	 * Alternates front/back/front/back from front (min Z) to back (max Z)
	 * One front/back pair for each layer.
	 */
	public cellDepths:Float32Array;
	/**
	 * dz/dx0, dz/dy0, dz/dx1, dz/dy1, ...
	 */
	public cellSlopes:Float32Array;
	
	public get bounds():Rectangle { return this._bounds; }
	public get area():number { return this.width * this.height; }
	
	constructor(width:number, height:number, layerCount:number=1) {
		this.width = width|0;
		this.height = height|0;
		this.layerCount = layerCount;
		this._bounds = new Rectangle(0, 0, this.width, this.height);
		const cellCount:number = (width*height)|0;
		this.cellMaterialIndexes = new Uint16Array(cellCount);
		this.cellDepths    = new Float32Array(cellCount*layerCount*2);
		this.cellSlopes    = new Float32Array(cellCount*2);
		this.initBuffer();
	}
	
	public initBuffer() {
		// Primary shape data
		this.cellMaterialIndexes.fill(0);
		this.cellDepths.fill(Infinity);
		this.cellSlopes.fill(0);
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
			frontDepth: this.cellDepths[idx],
			backDepth: this.cellDepths[idx+this.width*this.height],
			dzDx: this.cellSlopes[idx*2+0],
			dzDy: this.cellSlopes[idx*2+1],
		};
	};
}
