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
	// TODO: wouldn't it be simpler and still work to just do avgZ < oldAvgZ?
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

ShapeSheetUtil.prototype.plotFlatTBQuad = function(topY, bottomY, topX0, topZ0, topX1, topZ1, bottomX0, bottomZ0, bottomX1, bottomZ1) {
	// e.g. topY = 0.5, bottomY = 2, topX0 = topX1 = 2.5, bottomX0 = 1, bottomX1 = 5
	//
	//   0        1        2   2.5  3        4        5        6        7
	//0  +--------+--------+--------+--------+--------+--------+--------+
	//   |        |        |        |        |        |        |        |
	//0.5|        |        |    ._  |        |        |        |        |
	//   |        |        |  _/  \_|_       |        |        |        |
	//   |        |        |_/      | \__    |        |        |        |
	//1  +--------+--------x--------x--------+--------+--------+--------+
	//   |        |      _/|        |    \__ |        |        |        |
	//   |        |    _/  |        |       \|__      |        |        |
	//   |        |  _/    |        |        |  \__   |        |        |
	//   |        |_/      |        |        |     \__|        |        |
	//2  +--------x--------x--------x--------x--------x--------+--------+
   //
	// First thoughts:
	// Any pixel containing any part of the polygon gets colored with material if average conrer Z < what was there
	// Only corners lying within or on the edge of the polygon and with Z < current corner Z get depth marked
	// 
	// It might be easier just to plot spheres all over the place...
	
	var ss = this.shapeSheet;
	var cellCornerDepths = ss.cellCornerDepths;
	var cellMaterialIndexes = ss.cellMaterialIndexes;
	var ssWidth = ss.width;
	
	var height = bottomY-topY;
	var diffX0 = bottomX0-topX0, diffX1 = bottomX1-topX1;
	var diffZ0 = bottomZ0-topZ0, diffZ1 = bottomZ1-topZ1;
	
	// TODO: Use clip bounds instead of 0,0,ss.width,ss.height
	
	var py;
	// Do it in rows!
	var startY = Math.max(        0, topY              )|0;
	var endY   = Math.min(ss.height, Math.ceil(bottomY))|0;
	for( py=startY; py < bottomY; ++py ) {
		var rowTopY = py, rowBottomY = py+1;
		var topRatio    = (rowTopY   -topY)/height;
		var bottomRatio = (rowBottomY-topY)/height;
		var rowTopX0    = topX0+diffX0*topRatio   , rowTopX1    = topX1+diffX1*topRatio   ;
		var rowBottomX0 = topX0+diffX0*bottomRatio, rowBottomX1 = topX1+diffX1*bottomRatio;
		var rowTopZ0    = topZ0+diffZ0*topRatio   , rowTopZ1    = topZ1+diffZ1*topRatio   ;
		var rowBottomZ0 = topZ0+diffZ0*bottomRatio, rowBottomZ1 = topZ1+diffZ1*bottomRatio;
		var leftX;
		var startX = Math.max(      0, Math.min(rowTopX0,rowBottomX0))|0;
		var endX   = Math.min(ssWidth, Math.ceil(Math.max(rowTopX1,rowBottomX1)))|0; // right side of the last pixel of the row
		var idx; // Index into sheet data
		for( leftX=startX, idx=leftX*ssWidth; leftX<endX; ++leftX, ++idx ) {
			var rightX = leftX+1;
			var rowTopDiffZ    = rowTopZ1   -rowTopZ0;
			var rowBottomDiffZ = rowBottomZ1-rowBottomZ0;
			var rowTopWidth = (rowTopX1-rowTopX0), rowBottomWidth = rowBottomX1-rowBottomX0; // May be negative!
			if( rowTopWidth    == 0 ) rowTopWidth    = 1; // Avoid /0 in cases where we can't do anything about it anyway
			if( rowBottomWidth == 0 ) rowBottomWidth = 1; // Avoid /0 in cases where we can't do anything about it anyway
			var topRightRatio    = (rightX-   rowTopX0)/rowTopWidth   , topLeftRatio    = (leftX-   rowTopX0)/rowTopWidth   ;
			var bottomRightRatio = (rightX-rowBottomX0)/rowBottomWidth, bottomLeftRatio = (leftX-rowBottomX0)/rowBottomWidth;
			
			var incTopLeft     = leftX  >= rowTopX0    && leftX  <= rowTopX1;
			var incTopRight    = rightX >= rowTopX0    && rightX <= rowTopX1;
			var incBottomLeft  = leftX  >= rowBottomX0 && leftX  <= rowBottomX1;
			var incBottomRight = rightX >= rowBottomX0 && rightX <= rowBottomX1;
			
			var topLeftZ     = incTopLeft     ?    rowTopZ0 +     topLeftRatio*rowTopDiffZ    : Infinity;
			var topRightZ    = incTopRight    ?    rowTopZ0 +    topRightRatio*rowTopDiffZ    : Infinity;
			var bottomLeftZ  = incBottomLeft  ? rowBottomZ0 +  bottomLeftRatio*rowBottomDiffZ : Infinity;
			var bottomRightZ = incBottomRight ? rowBottomZ0 + bottomRightRatio*rowBottomDiffZ : Infinity;
			
			this.plotPixel( leftX, rowTopY, topLeftZ, topRightZ, bottomLeftZ, bottomRightZ );
		}
	}
	
	var boundingBoxX0 = Math.min(topX0, bottomX0)|0, boundingBoxX1 = Math.ceil(Math.max(topX1,bottomX1))|0;
	
	this.renderer.dataUpdated(boundingBoxX0, startY, boundingBoxX1-boundingBoxX0, endY-startY, true, true);
};

/**
 * If the fingers of your left hand wrap around a polygon (i.e. clockwise)
 * the un-normalized vector of your left thumb has this Z component
 * 
 * (negative Z being out of the screen, positive being into it)
 */
ShapeSheetUtil.prototype.leftThumbZ = function( points ) {
	var normalX=0, normalY=0, normalZ=0;
	var i, j;
	var vertexCount = points.length/3;
	for( i=0, j=1; i<vertexCount; ++i, ++j ) {
		if( j == vertexCount ) j = 0;
		normalX += (points[i*3+2] + points[j*3+2]) * (points[j*3+1] - points[i*3+1]);
		normalY += (points[i*3+0] + points[j*3+0]) * (points[j*3+2] - points[i*3+2]);
		normalZ += (points[i*3+1] + points[j*3+1]) * (points[j*3+0] - points[i*3+0]);
	}
	return normalZ;
};

ShapeSheetUtil.prototype.plotConvexPolygon = function( points ) {
	var normalZ = this.leftThumbZ(points);
	if( normalZ > 0 ) return; // back face culling!
	
	var vertexCount = points.length/3;
	var topY = Infinity, bottomY = -Infinity;
	var topIndex = 0, bottomIndex = 0;
	var i;
	for( i=0; i<vertexCount; ++i ) {
		var y = points[i*3+1];
		if( y < topY    ) { topY    = y; topIndex    = i; }
		if( y > bottomY ) { bottomY = y; bottomIndex = i; }
	}
	// From the top to the bottom, draw thing.
	var sectTopIndex = topIndex, leftIndex = topIndex, rightIndex = topIndex;
	y = points[topIndex*3+1];
	var rightX = points[topIndex*3+0], rightZ = points[topIndex*3+2];
	var leftX = rightX, leftZ = rightZ;
	var nextY, nextRightX, nextRightZ, nextLeftX, nextLeftZ;
	while( leftIndex != bottomIndex ) {
		var nextLeftIndex = leftIndex-1;
		if( nextLeftIndex < 0 ) nextLeftIndex += vertexCount;
		var nextRightIndex = rightIndex+1;
		if( nextRightIndex >= vertexCount ) nextRightIndex -= vertexCount;
		
		var moveLeft, moveRight, moveRat;
		
		if( (nextY = points[nextRightIndex*3+1]) == points[nextLeftIndex*3+1] ) {
			moveLeft = moveRight = true;
		} else if( (nextY = points[nextRightIndex*3+1]) < points[nextLeftIndex*3+1] ) {
			nextY = points[nextRightIndex*3+1];
			moveRight = true; moveLeft = false;
		} else {
			nextY = points[nextLeftIndex*3+1];
			moveLeft = true; moveRight = false;
		}
		if( moveRight ) {
			nextRightX = points[nextRightIndex*3+0];
			nextRightZ = points[nextRightIndex*3+2];
		} else {
			moveRat = (nextY-y)/(points[nextRightIndex*3+1]-y);
			nextRightX = rightX + moveRat*(points[nextRightIndex*3+0]-rightX);
			nextRightZ = rightZ + moveRat*(points[nextRightIndex*3+2]-rightZ);
		}
		if( moveLeft ) {
			nextLeftX  = points[nextLeftIndex*3+0];
			nextLeftZ  = points[nextLeftIndex*3+2];
		} else {
			moveRat = (nextY-y)/(points[nextLeftIndex*3+1]-y);
			nextLeftX = leftX + moveRat*(points[nextLeftIndex*3+0]-leftX);
			nextLeftZ = leftZ + moveRat*(points[nextLeftIndex*3+2]-leftZ);
		}
		
		this.plotFlatTBQuad(y, nextY, leftX, leftZ, rightX, rightZ, nextLeftX, nextLeftZ, nextRightX, nextRightZ);
		console.log("plotFlatTBQuad", y, nextY, leftX, leftZ, rightX, rightZ, nextLeftX, nextLeftZ, nextRightX, nextRightZ);
		if( moveLeft  ) leftIndex  = nextLeftIndex;
		if( moveRight ) rightIndex = nextRightIndex;
		y = nextY;
		rightX = nextRightX;	rightZ = nextRightZ;
		 leftX =  nextLeftX;  leftZ =  nextLeftZ;
	}
};

ShapeSheetUtil.prototype.plotAABeveledCuboid = function( x, y, z, w, h, bevelDepth ) {
	var x0 = x, x1=x+bevelDepth, x2=x+w-bevelDepth, x3=x+w;
	var y0 = y, y1=y+bevelDepth, y2=y+h-bevelDepth, y3=y+h;
	var z0 = z, z1 = z+bevelDepth;

	this.plotFlatTBQuad( y0, y1, x1,z1, x1,z1, x0,z1, x1,z0 ); // top left
	this.plotFlatTBQuad( y0, y1, x1,z1, x2,z1, x1,z0, x2,z0 ); // top
	this.plotFlatTBQuad( y0, y1, x2,z1, x2,z1, x2,z0, x3,z1 ); // top right
	this.plotFlatTBQuad( y1, y2, x0,z1, x1,z0, x0,z1, x1,z0 ); // left
	this.plotFlatTBQuad( y1, y2, x1,z0, x2,z0, x1,z0, x2,z0 ); // middle
	this.plotFlatTBQuad( y1, y2, x2,z0, x3,z1, x2,z0, x3,z1 ); // right
	this.plotFlatTBQuad( y2, y3, x0,z1, x1,z0, x1,z1, x1,z1 ); // bottom left
	this.plotFlatTBQuad( y2, y3, x1,z0, x2,z0, x1,z1, x2,z1 ); // bottom
	this.plotFlatTBQuad( y2, y3, x2,z0, x3,z1, x2,z1, x2,z1 ); // bottom right
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

module.ShapeSheetUtil = ShapeSheetUtil;

})();
