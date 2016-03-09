(function() {
"use strict";

var module = window;

var LARGE_NUMBER = 1000;

var ShapeSheetUtil = function(shapeSheet, renderer) {
	this._shapeSheet = shapeSheet;
	this.renderer = renderer;
	this.plottedMaterialIndexFunction = function(x, y, z, z0, z1, z2, z3) {
		return 4 + (Math.random()*4)|0;
	};
};

Object.defineProperty(ShapeSheetUtil.prototype, "shapeSheet", {
	"get": function() { return this._shapeSheet; },
	"set": function(ss) {
		this._shapeSheet = ss;
		this.renderer.shapeSheet = ss;
	}
});

//// Plotting

var infiniMinus = function(a, b) {
	if( a === b ) return 0;
	if( a === +Infinity ) {
		if( b === -Infinity ) return 0;
		return +LARGE_NUMBER;
	}
	if( a === -Infinity ) {
		if( b === +Infinity ) return 0;
		return -LARGE_NUMBER;
	}
	return a - b;
};

ShapeSheetUtil.prototype.plotPixel = function(x, y, z0, z1, z2, z3, materialIndex) {
	var ss = this.shapeSheet;
	x = x|0;
	y = y|0;
	if( x < 0 ) return;
	if( y < 0 ) return;
	var width = ss.width;
	var cellMaterialIndexes = ss.cellMaterialIndexes;
	var cellCornerDepths = ss.cellCornerDepths;
	if( x >= width ) return;
	if( y >= ss.height ) return;
	
	if( materialIndex == null ) {
		var avgZ = (z0+z1+z2+z3)/4;
		materialIndex = (this.plottedMaterialIndexFunction)(x,y,avgZ,z0,z1,z2,z3);
	}
	
	var idx = x+y*width;
	var oldZ0 = cellCornerDepths[idx*4+0],
	    oldZ1 = cellCornerDepths[idx*4+1],
	    oldZ2 = cellCornerDepths[idx*4+2],
	    oldZ3 = cellCornerDepths[idx*4+3];
	var ox =
		  infiniMinus(z0, oldZ0) +
		  infiniMinus(z1, oldZ1) +
		  infiniMinus(z2, oldZ2) +
		  infiniMinus(z3, oldZ3);
	if( z0 < oldZ0 ) cellCornerDepths[idx*4+0] = z0;
	if( z1 < oldZ1 ) cellCornerDepths[idx*4+1] = z1;
	if( z2 < oldZ2 ) cellCornerDepths[idx*4+2] = z2;
	if( z3 < oldZ3 ) cellCornerDepths[idx*4+3] = z3;
	if( ox < 0 ) {
		// Then our new thing is on average in front of the old thing
		cellMaterialIndexes[idx] = materialIndex;
	}
};
/** Shift the Z of every cell by this amount. */
ShapeSheetUtil.prototype.shiftZ = function(diff) {
	var ss = this.shapeSheet;
	var i;
	var cellCornerDepths = ss.cellCornerDepths;
	var cellAverageDepths = ss.cellAverageDepths;
	
	for( i=ss.width*ss.height*4-1; i>=0; --i ) {
		cellCornerDepths[i] += diff;
	}
	for( i=ss.width*ss.height-1; i>=0; --i ) {
		cellAverageDepths[i] += diff;
	}
	if( this.renderer.shaders.length > 0 ) {
		this.renderer.dataUpdated(0,0,null,null, false, true);
	}
};
ShapeSheetUtil.prototype.plotSphere = function(centerX, centerY, centerZ, rad) {
	var i;
	var sphereDepth = (function(x,y) {
		var sphereX = (x - centerX) / rad;
		var sphereY = (y - centerY) / rad;
		var d = sphereX*sphereX + sphereY*sphereY;
		if( d >  1 ) return Infinity;
		if( d == 1 ) return centerZ;
		
		// z*z + x*x + y*y = 1
		// z*z = 1 - (x*x + y*y)
		// z = Math.sqrt(1 - (x*x+y*y))
		
		return centerZ - rad * Math.sqrt(1 - d);
		
	}).bind(this);
	var x, y;
	var width = this.shapeSheet.width;
	var height = this.shapeSheet.height;
	for( i=0, y=0; y<height; ++y ) {
		for( x=0; x<width; ++x, ++i ) {
			this.plotPixel(
				x, y,
				sphereDepth(x+0,y+0),
				sphereDepth(x+1,y+0),
				sphereDepth(x+0,y+1),
				sphereDepth(x+1,y+1)
			);
		}
	}
	this.renderer.dataUpdated(centerX-rad, centerY-rad, rad*2, rad*2, true, true);
};

//// Demo

ShapeSheetUtil.prototype.buildDemo = function() {
	this.plotSphere(this.width/2, this.height/2, this.width/2, this.width*(1.0/8));
	var i;
	for( i=0; i<200; ++i ) {
		var r = 2 * Math.PI * i / 200;
		this.plotSphere(
			this.width/2  + Math.cos(r)*this.width*(3.0/8),
			this.height/2 + Math.sin(r)*this.height*(3.0/8),
			this.width/2,
			this.height/8);
	}
};

ShapeSheetUtil.prototype.animateLights = function() {
	var lightsMoving = true;
	var f = 0;
	return setInterval( (function() {
		if( lightsMoving ) {
			this.lights[0].direction = [+Math.sin(f*0.01),  0.8, +Math.cos(f*0.01)];
			this.lights[1].direction = [-Math.sin(f*0.005), -0.8, -Math.cos(f*0.005)];
			this.lightsUpdated();
			++f;
		}
		this.requestCanvasUpdate();
	}).bind(this), 1000 / 60);
};

ShapeSheetUtil.prototype.animateLavaLamp = function() {
	var x = this.width/2, y = this.width/2, rad = Math.random()*this.width/8;
	var vx = 1, vy = 1, vrad = 0;
	var ang = 0;
	return setInterval((function() {
		rad = Math.abs(rad + vrad);
		if( rad <  4 ) { rad = 4; vrad = +1; }
		if( rad > this.width/4 ) { rad = this.width/4; vrad = -1; }
		
		x += vx;
		y += vy;
		if(      x-rad <= 0           ) { x = rad            ; vx = +Math.abs(vx); }
		else if( x+rad >= this.width  ) { x = this.width-rad ; vx = -Math.abs(vx); }
		if(      y-rad <= 0           ) { y = rad            ; vy = +Math.abs(vy); }
		else if( y+rad >= this.height ) { y = this.height-rad; vy = -Math.abs(vy); }
		if( Math.abs(vx) > 1 ) vx *= 0.5;
		if( Math.abs(vy) > 1 ) vy *= 0.5;
		
		vx   += Math.random()-0.5;
		vy   += Math.random()-0.5;
		
		vrad += Math.random()-0.5;
		if( Math.abs(vrad) > 1 ) vrad *= 0.5;

		this.shiftZ(1);
		var vMag = Math.sqrt(vx*vx + vy*vy);
		var aheadX = vx / vMag, aheadY = vy / vMag;
		var sideX  = aheadY   , sideY = -aheadX;
		var loopRad = this.width/8;
		var sin = Math.sin(ang);
		var cos = Math.cos(ang);
		var plotX = x + sin * sideX * loopRad;
		var plotY = plotY = y + sin * sideY * loopRad;
		var plotZ = 0 + cos * loopRad;
		
		this.plotSphere(plotX, plotY, plotZ, rad);
		
		this.requestCanvasUpdate();
		
		ang += Math.PI / 16;
	}).bind(this), 10);
};

module.ShapeSheetUtil = ShapeSheetUtil;

})();
