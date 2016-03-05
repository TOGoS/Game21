(function() {
"use strict";

var module = window;

var LARGE_NUMBER = 1000;

var normalizeVect3d = function(vect) {
	var len = Math.sqrt(vect[0]*vect[0] + vect[1]*vect[1] + vect[2]*vect[2]);
	return [vect[0]/len, vect[1]/len, vect[2]/len];
};

var ShapeEditor = function(width,height) {
	this.materials = [
		{
			diffuse: [1,1.0,0.9,1.0]
		},
		{
			diffuse: [1,0.9,0.8,1.0]
		},
		{
			diffuse: [1,0.8,0.7,1.0]
		}
	];
	
	this.lights = [
		{
			direction: [1,2,1],
			color: [0.3, 0.5, 0.5]
		},
		{
			direction: [-1,-2,-1],
			color: [0.1, 0.01, 0.01]
		}
	];
	this.normalizeLights();
	
	this.shaders = [];
	
	this.initBuffer(width,height);
};
ShapeEditor.prototype.initBuffer = function(width,height) {
	this.width = width|0;
	this.height = height|0;
	var cellCount = this.width*this.height;
	// Primary shape data
	this.cellMaterialIndexes = new Uint16Array( cellCount);
	this.cellCornerDepths    = new Float32Array(cellCount*4); // Depth (in pixels) of each corner
	this.cellCornerDepths.fill(Infinity);
	// calculated by calculateCellDepthDerivedData based on cellCornerDepths:
	this.updatingDepthRectangles = []; // Tracks rectangles that need to have calculateCellDepthDerivedData called
	this.cellCoverages       = new Uint8Array(cellCount); // coverage based on depth; 0,1,2,3,4 (divide by 4.0 to get opacity factor)
	this.cellAverageDepths   = new Float32Array(cellCount);
	this.cellNormals         = new Float32Array(cellCount*3); // normal vector X,Y,Z
	// calculated by calculateCellColors based on the above:
	this.updatingColorRectangles  = []; // Tracks rectangles that need to have calculateCellColors called
	this.updatingCanvasRectangles = []; // Tracks rectangles that need to be copied to the canvas
	this.cellColors        = new Float32Array(cellCount*4); // r,g,b,a of each cell after shading
	this.cellColors               = new Float32Array(cellCount*4); // r,g,b,a of each cell after shading and fogging
	
	this.canvasUpdateRequested = false;
};
ShapeEditor.prototype.normalizeLights = function() {
	// Normalize light directions!
	var l, light;
	for( l in this.lights ) {
		// normalize direction!
		light = this.lights[l];
		light.direction = normalizeVect3d(light.direction);
	}
};
ShapeEditor.prototype.initUi = function(previewCanvas) {
	this.previewCanvas = previewCanvas;
};

var calcOpacity4 = function(z0, z1, z2, z3) {
	var opac = 1;
	if( z0 === Infinity ) opac -= 0.25;
	if( z1 === Infinity ) opac -= 0.25;
	if( z2 === Infinity ) opac -= 0.25;
	if( z3 === Infinity ) opac -= 0.25;
	return opac;
};
var calcSlope2 = function(z0,z1) {
	if( z0 === z1 && (z0 === Infinity || z0 === -Infinity) ) return null; // Indicate to caller not to use this value
	if( z0 === Infinity ) return -Infinity;
	if( z1 === Infinity ) return +Infinity;
	return z1 - z0;
};
var calcSlope4 = function(z0,z1,z2,z3) {
	var s0 = calcSlope2(z0,z1);
	var s1 = calcSlope2(z2,z3);
	if( s0 === null && s1 === null ) {
		return 0; // Should be completely transparent so this won't really matter
	} else if( s0 === null ) {
		return s1;
	} else if( s1 === null ) {
		return s0;
	} else if( s0 === Infinity ) {
		if( s1 === Infinity ) {
			return LARGE_NUMBER;
		} else if( s1 === -Infinity ) {
			return 0;
		} else {
			return s1;
		}
	} else if( s0 === -Infinity ) {
		if( s1 === Infinity ) {
			return 0;
		} else if( s1 === -Infinity ) {
			return -LARGE_NUMBER;
		} else {
			return s1;
		}
	} else {
		if( s1 === Infinity ) {
			return s0;
		} else if( s1 === -Infinity ) {
			return s0;
		} else {
			return (s1 + s0)/2.0;
		}
	}
};

ShapeEditor.prototype.calculateDepthDerivedData = function(minX, minY, w, h) {
	var width = this.width, height = this.height;
	var maxX = minX+w, maxY = minY+h;
	if( minX < 0 ) minX = 0;
	if( maxX > width ) maxX = width;
	if( minY < 0 ) minY = 0;
	if( maxY > height ) maxY = height;
	w = maxX-minX, h = maxY-minY;
	if( w <= 0 || h <= 0 ) return;
	
	var i, x, y;
	var cornerDepths = this.cellCornerDepths;
	var averageDepths = this.cellAverageDepths;
	
	var cellCoverages = this.cellCoverages;
	var cellNormals = this.cellNormals;

	for( i=0, y=minY; y<maxY; ++y ) for( x=minX, i=width*y+x; x<maxX; ++x, ++i ) {
		var z0 = cornerDepths[i*4+0],
		    z1 = cornerDepths[i*4+1],
		    z2 = cornerDepths[i*4+2],
		    z3 = cornerDepths[i*4+3];
		
		var tot = 0, cnt = 0;
		if( z0 !== Infinity ) { tot += z0; ++cnt; }
		if( z1 !== Infinity ) { tot += z1; ++cnt; }
		if( z2 !== Infinity ) { tot += z2; ++cnt; }
		if( z3 !== Infinity ) { tot += z3; ++cnt; }
		averageDepths[i] = (cnt == 0) ? Infinity : tot/cnt;
		
		var opac = calcOpacity4(z0,z1,z2,z3);
		var dzdx = calcSlope4(z0,z1,z2,z3);
		var dzdy = calcSlope4(z0,z2,z1,z3);
		
		var normalX = dzdx;
		var normalY = dzdy;
		var normalZ = -1;
		var normalLength = Math.sqrt(normalZ*normalZ + normalX*normalX + normalY*normalY);
		normalX /= normalLength;
		normalY /= normalLength;
		normalZ /= normalLength;
		
		cellCoverages[i] = opac * 4;
		cellNormals[i*3+0] = normalX;
		cellNormals[i*3+1] = normalY;
		cellNormals[i*3+2] = normalZ;
	}
};

ShapeEditor.prototype.updateDepthDerivedData = function() {
	processRectangleUpdates(this.updatingDepthRectangles, this.calculateDepthDerivedData.bind(this));
};

ShapeEditor.prototype.calculateCellColors = function(minX, minY, w, h) {
	var width = this.width, height = this.height;
	var maxX = minX+w, maxY = minY+h;
	if( minX < 0 ) minX = 0;
	if( maxX > width ) maxX = width;
	if( minY < 0 ) minY = 0;
	if( maxY > height ) maxY = height;
	w = maxX-minX, h = maxY-minY;
	if( w <= 0 || h <= 0 ) return;
	
	var i, l, x, y;
	var cellColors = this.cellColors;
	var cellCoverages = this.cellCoverages;
	var cellNormals = this.cellNormals;
	var materials = this.materials;
	var cellMaterialIndexes = this.cellMaterialIndexes;
	var lights = this.lights;
	var light;
	
	for( i=0, y=minY; y<maxY; ++y ) for( x=minX, i=width*y+x; x<maxX; ++x, ++i ) {
		var mat = materials[cellMaterialIndexes[i]];
		// Z being 'into' the picture (right-handed coordinate system!)
		
		var normalX = cellNormals[i*3+0],
		    normalY = cellNormals[i*3+1],
		    normalZ = cellNormals[i*3+2];
		
		var r = 0, g = 0, b = 0, a = mat.diffuse[3] * cellCoverages[i] * 0.25;
		for( l in lights ) {
			light = lights[l];
			var dotProd = -(normalX*light.direction[0] + normalY*light.direction[1] + normalZ*light.direction[2]);
			if( dotProd > 0 ) {
				var diffuseAmt = dotProd; // Yep, that's how you calculate it.
				r += diffuseAmt * light.color[0] * mat.diffuse[0];
				g += diffuseAmt * light.color[1] * mat.diffuse[1];
				b += diffuseAmt * light.color[2] * mat.diffuse[2];
			}
		}
		cellColors[i*4+0] = r;
		cellColors[i*4+1] = g;
		cellColors[i*4+2] = b;
		cellColors[i*4+3] = a;
	}
	var s;
	for( s in this.shaders ) {
		this.shaders[s](this, minX, minY, w, h);
	}
};

ShapeEditor.prototype.updateCellColors = function() {
	this.updateDepthDerivedData();
	processRectangleUpdates(this.updatingColorRectangles, this.calculateCellColors.bind(this));
};

ShapeEditor.prototype.copyToCanvas = function(minX,minY,w,h) {
	var width = this.width, height = this.height;
	var maxX = minX+w, maxY = minY+h;
	if( minX < 0 ) minX = 0;
	if( maxX > width ) maxX = width;
	if( minY < 0 ) minY = 0;
	if( maxY > height ) maxY = height;
	w = maxX-minX, h = maxY-minY;
	if( w <= 0 || h <= 0 ) return;

	var ctx = this.previewCanvas.getContext('2d');
	var encodeColorValue = function(i) {
		var c = Math.pow(i, 0.45);
		if( c > 1 ) return 255;
		return (c*255)|0;
	};
	var cellColors = this.cellColors;
	
	var imgData = ctx.getImageData(minX, minY, w, h);
	var imgDataData = imgData.data;

	var bi, idi, x, y;
	for( idi=0, y=minY; y<maxY; ++y ) {
		for( x=minX, bi=width*y+x; x<maxX; ++x, ++bi, ++idi ) {
			imgDataData[idi*4+0] = encodeColorValue(cellColors[bi*4+0]);
			imgDataData[idi*4+1] = encodeColorValue(cellColors[bi*4+1]);
			imgDataData[idi*4+2] = encodeColorValue(cellColors[bi*4+2]);
			imgDataData[idi*4+3] = this.cellColors[bi*4+3] * 255;
		}
	}
	ctx.putImageData(imgData, minX, minY);
};

var processRectangleUpdates = function(rectangleList, updater) {
	var i, r;
	for( i in rectangleList ) {
		r = rectangleList[i];
		updater(r[0], r[1], r[2], r[3]);
	}
	rectangleList.splice(0);
};

ShapeEditor.prototype.updateCanvas = function() {
	var i, r;
	this.updateCellColors();
	processRectangleUpdates(this.updatingCanvasRectangles, this.copyToCanvas.bind(this));
};

ShapeEditor.prototype.requestCanvasUpdate = function() {
	if( this.canvasUpdateRequested ) return;
	this.canvasUpdateRequested = true;
	window.requestAnimationFrame( (function() {
		this.canvasUpdateRequested = false;
		this.updateCanvas();
	}).bind(this) );
};

////

var rectangleOverlapFactor = function(r0, x1, y1, w1, h1) {
	var x0 = r0[0], y0 = r0[1], w0 = r0[2], h0 = r0[3];
	var e0 = x0+w0, s0 = y0+h0; // east, south
	if( x1 >= e0 || y1 >= s0 ) return 0;
	var e1 = x1+w1, s1 = y1+h1;
	if( x0 >= e1 || y0 >= s1 ) return 0;
	
	var xS = Math.max(x0,x1);
	var yS = Math.max(y0,y1);
	var eS = Math.min(e0,e1);
	var sS = Math.min(s0,s1);
	var wS = eS-xS, hS = sS-yS;
	
	var area0 = w0*h0, area1 = w1*h1, areaS = wS*hS;
	
	return areaS / Math.min(area0, area1);
};
var combineRectangle = function(r0, x1, y1, w1, h1) {
	var x0 = r0[0], y0 = r0[1], w0 = r0[2], h0 = r0[3];
	var e0 = x0+w0, s0 = y0+h0; // east, south
	var e1 = x1+w1, s1 = y1+h1;
	r0[0] = Math.min(x0,x1);
	r0[1] = Math.min(y0,y1);
	r0[2] = Math.max(e0,e1) - r0[0];
	r0[3] = Math.max(s0,s1) - r0[1];
};
var maybeCombineRectangle = function(r, x1, y1, w1, h1) {
	var of = rectangleOverlapFactor(r, x1, y1, w1, h1);
	if( of > 0 ) {
		// could use a higher number, or have it depend on total area or something, but whatevs
		combineRectangle(r, x1, y1, w1, h1);
		return true;
	} else {
		return false;
	}
};
var addToUpdateRectangleList = function(rectangleList, x, y, w, h) {
	var i;
	for( i in rectangleList ) {
		var reg = rectangleList[i];
		if( maybeCombineRectangle(reg, x, y, w, h) ) return;
	};
	rectangleList.push([x,y,w,h]);
};

ShapeEditor.prototype.dataUpdated = function(x, y, w, h, updatedDepth, updatedMaterial) {
	if( x === null || x < 0 ) x = 0;
	if( y === null || y < 0 ) y = 0;
	if( w === null || w+x >= this.width  ) w = this.width-x;
	if( h === null || h+y >= this.height ) h = this.height-y;
	
	var east = x+w, south=y+h;
	x = x|0; y = y|0;
	w = (Math.ceil(east )-x)|0;
	h = (Math.ceil(south)-y)|0;
	if( updatedDepth ) {
		addToUpdateRectangleList(this.updatingDepthRectangles, x, y, w, h);
		updatedMaterial = true; // Not really, but...
	}
	if( updatedMaterial ) {
		addToUpdateRectangleList(this.updatingColorRectangles, x, y, w, h);
		addToUpdateRectangleList(this.updatingCanvasRectangles, x, y, w, h);
	}
};

ShapeEditor.prototype.lightsUpdated = function() {
	this.normalizeLights();
	// Gotta recalculate everything!
	addToUpdateRectangleList(this.updatingColorRectangles, 0, 0, this.width, this.height);
	addToUpdateRectangleList(this.updatingCanvasRectangles, 0, 0, this.width, this.height);
};

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

ShapeEditor.prototype.plotPixel = function(x, y, z0, z1, z2, z3, materialIndex) {
	x = x|0;
	y = y|0;
	if( x < 0 ) return;
	if( y < 0 ) return;
	var width = this.width;
	var cellMaterialIndexes = this.cellMaterialIndexes;
	var cellCornerDepths = this.cellCornerDepths;
	if( x >= width ) return;
	if( y >= this.height ) return;
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
ShapeEditor.prototype.shiftZ = function(diff) {
	var i;
	var cellCornerDepths = this.cellCornerDepths;
	var cellAverageDepths = this.cellAverageDepths;
	
	for( i=this.width*this.height*4-1; i>=0; --i ) {
		cellCornerDepths[i] += diff;
	}
	for( i=this.width*this.height-1; i>=0; --i ) {
		cellAverageDepths[i] += diff;
	}
	if( this.recolorFunction !== null ) {
		// Normals and averages don't need recalculating,
		// but color might.
		this.dataUpdated(0,0,null,null, false, true);
	}
};
ShapeEditor.prototype.plotSphere = function(centerX, centerY, centerZ, rad) {
	var i;
	var sphereDepth = (function(x,y) {
		var sphereX = (x - centerX) / rad;
		var sphereY = (y - centerY) / rad;
		// 1 = Math.sqrt(sphereX**2 + sphereY**2 + sphereZ**2)
		// 1 = sphereX**2 + sphereY**2 + sphereZ ** 2
		// 1 - sphereZ**2 = sphereX**2 + sphereY**2
		// -sphereZ**2 = sphereX**2 + sphereY**2 - 1
		// sphereZ**2 = 1 - (sphereX**2 + sphereY**2)
		var h = 1 - (sphereX*sphereX + sphereY*sphereY);
		if( h < 0 ) return Infinity;
		
		var sphereZ = Math.sqrt( h );
		return (1 - sphereZ) * this.width / 2;
	}).bind(this);
	var x, y;
	for( i=0, y=0; y<this.height; ++y ) {
		for( x=0; x<this.width; ++x, ++i ) {
			var materialIndex = (Math.random()*3)|0;
			this.plotPixel(
				x, y,
				sphereDepth(x+0,y+0),
				sphereDepth(x+1,y+0),
				sphereDepth(x+0,y+1),
				sphereDepth(x+1,y+1),
				materialIndex
			);
			/*
			this.cellMaterialIndexes[i] = materialIndex;
			this.cellCornerDepths[i*4+0] = sphereDepth(x+0,y+0);
			this.cellCornerDepths[i*4+1] = sphereDepth(x+1,y+0);
			this.cellCornerDepths[i*4+2] = sphereDepth(x+0,y+1);
			this.cellCornerDepths[i*4+3] = sphereDepth(x+1,y+1);
			*/
		}
	}
	this.dataUpdated(centerX-rad, centerY-rad, rad*2, rad*2, true, true);
};

//// Demo

ShapeEditor.prototype.buildDemo = function() {
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

ShapeEditor.prototype.animateLights = function() {
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

ShapeEditor.prototype.animateLavaLamp = function() {
	var x = this.width/2, y = this.width/2, rad = Math.random()*this.width/8;
	var vx = 0, vy = 0, vrad = 0;
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
		if( Math.abs(vx) > rad/2 ) vx *= 0.5;
		if( Math.abs(vy) > rad/2 ) vy *= 0.5;
		
		vx   += Math.random()-0.5;
		vy   += Math.random()-0.5;
		
		vrad += Math.random()-0.5;
		if( Math.abs(vrad) > 1 ) vrad *= 0.5;

		this.shiftZ(1);
		this.plotSphere(x, y, Math.random()*this.width, rad);
		
		this.requestCanvasUpdate();
	}).bind(this), 10);
};

//// Color functions

ShapeEditor.makeFogShader = function(originDepth, fogR, fogG, fogB, fogA) {
	return function(se, minX, minY, w, h) {
		minX = minX|0; minY = minY|0; w = w|0; h = h|0;
		var maxX=(minX+w)|0, maxY=(minY+h)|0;
		var width = se.width;
		var cellAverageDepths = se.cellAverageDepths;
		var cellColors = se.cellColors;
		var x, y, i, d, r, g, b, a, oMix, fMix;
		var fogT = (1-fogA); // Fog transparency; how much of original color to keep at depth = 1 pixel
		for( y=minY; y<maxY; ++y ) for( i=y*width, x=minX; x<maxX; ++x, ++i ) {
			d = cellAverageDepths[i];
			if( d < originDepth ) continue;
			if( d === Infinity ) {
				cellColors[i*4+0] = fogR;
				cellColors[i*4+1] = fogG;
				cellColors[i*4+2] = fogB;
				cellColors[i*4+3] = fogA == 0 ? 0 : 1;
				continue;
			}
			
			r = cellColors[i*4+0];
			g = cellColors[i*4+1];
			b = cellColors[i*4+2];
			a = cellColors[i*4+3];
			
			// Mix in fog *behind* this point (from the surface to infinity, which is always just fog color)
			r = r*a + fogR*(1-a);
			g = g*a + fogG*(1-a);
			b = b*a + fogB*(1-a);
			// Now add the fog ahead;
			// mix = how much of the original color to keep
			oMix = Math.pow(fogT, (cellAverageDepths[i] - originDepth));
			fMix = 1-oMix;
			cellColors[i*4+0] = r*oMix + fogR*fMix;
			cellColors[i*4+1] = g*oMix + fogG*fMix;
			cellColors[i*4+2] = b*oMix + fogB*fMix;
			// At infinity, everything fades to fog color unless fog color = 0,
			// so that's the only case where there can be any transparency
			if( fogA > 0 ) cellColors[i*4+3] = 1;
		}
	};
};

module.ShapeEditor = ShapeEditor;

})();
