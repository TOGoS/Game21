(function() {
"use strict";

var RailDemo = function(shapeSheetUtil) {
	this.shapeSheetUtil = shapeSheetUtil;
};

Object.defineProperty(RailDemo.prototype, "shapeSheet", {
	"get": function() { return this.shapeSheetUtil.shapeSheet; },
	"set": function(ss) { this.shapeSheetUtil.shapeSheet = ss; }
});
Object.defineProperty(RailDemo.prototype, "renderer", {
	"get": function() { return this.shapeSheetUtil.renderer; },
	"set": function(ss) { this.shapeSheetUtil.renderer = ss; }
});

RailDemo.prototype.drawCurve = function() {
	// this.shapeSheetUtil.plotLine( 8, 8, 8, 1, 32, 32, 32, 3 );
	var curve = makeCubicBezierCurve( [16, 32, 16], [16, 16, 16], [32, 16, 16], [32, 32, 16] );
	this.shapeSheetUtil.plotCurve( curve, 1, 2 );
};

RailDemo.prototype.run = function() {
	this.drawCurve();
	this.renderer.requestCanvasUpdate();
};


window.RailDemo = RailDemo;
})();
