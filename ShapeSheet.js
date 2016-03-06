(function() {
"use strict";

var module = window;

var ShapeSheet = function(width,height) {
	this.initBuffer(width,height);
};
ShapeSheet.prototype.initBuffer = function(width,height) {
	this.width = width|0;
	this.height = height|0;
	var cellCount = this.width*this.height;
	// Primary shape data
	this.cellMaterialIndexes = new Uint16Array( cellCount);
	this.cellCornerDepths    = new Float32Array(cellCount*4); // Depth (in pixels) of each corner
	this.cellCornerDepths.fill(Infinity);
	// calculated by calculateCellDepthDerivedData based on cellCornerDepths
	// (this stuff is only used by renderer; maybe it should live there):
	this.cellCoverages       = new Uint8Array(cellCount); // coverage based on depth; 0,1,2,3,4 (divide by 4.0 to get opacity factor)
	this.cellCoverages.fill(0);
	this.minimumAverageDepth = Infinity;
	this.cellAverageDepths   = new Float32Array(cellCount);
	this.cellAverageDepths.fill(Infinity);
	this.cellNormals         = new Float32Array(cellCount*3); // normal vector X,Y,Z
	// calculated by calculateCellColors based on the above:
	this.cellColors               = new Float32Array(cellCount*4); // r,g,b,a of each cell after shading
	
	this.canvasUpdateRequested = false;
};
ShapeSheet.prototype.getCellInfo = function(x, y) {
	var idx;
	if( y === null ) {
		idx = (x|0);
	} else {
		idx = (y|0)*this.width + (x|0);
	}
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


module.ShapeSheet = ShapeSheet;

})();
