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
	// calculated by calculateCellDepthDerivedData based on cellCornerDepths:
	this.cellCoverages       = new Uint8Array(cellCount); // coverage based on depth; 0,1,2,3,4 (divide by 4.0 to get opacity factor)
	this.cellAverageDepths   = new Float32Array(cellCount);
	this.cellNormals         = new Float32Array(cellCount*3); // normal vector X,Y,Z
	// calculated by calculateCellColors based on the above:
	this.cellColors               = new Float32Array(cellCount*4); // r,g,b,a of each cell after shading
	
	this.canvasUpdateRequested = false;
};

module.ShapeSheet = ShapeSheet;

})();
