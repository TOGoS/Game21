(function() {
"use strict";

var module = window;

var LARGE_NUMBER = 1000;

var normalizeVect3d = function(vect) {
	var len = Math.sqrt(vect[0]*vect[0] + vect[1]*vect[1] + vect[2]*vect[2]);
	return [vect[0]/len, vect[1]/len, vect[2]/len];
};

// fit vector to [-1..1, -1..1, -inf..inf]
var normalizeVect3dToXYUnitSquare = function(vect) {
	var len = Math.max(Math.abs(vect[0]), Math.abs(vect[1]));
	if( len == 0 ) return vect;
	return [vect[0]/len, vect[1]/len, vect[2]/len];
};

var ShapeSheetRenderer = function(shapeSheet, canvas) {
	this.shapeSheet = shapeSheet;
	this.canvas = canvas;
	this.shadowsEnabled = true;
	this.shaders = [];
	this.updatingDepthRectangles  = []; // Tracks rectangles that need to have calculateCellDepthDerivedData called
	this.updatingColorRectangles  = []; // Tracks rectangles that need to have calculateCellColors called
	this.updatingCanvasRectangles = []; // Tracks rectangles that need to be copied to the canvas
	
	// Need to set these last because setting them
	// may rely on other things being initialized
	
	this.materials = [
		// 0-3 (reserved)
		{
			diffuse: [0,0,0,0]
		},
		{
			diffuse: [0,0,0,0]
		},
		{
			diffuse: [0,0,0,0]
		},
		{
			diffuse: [0,0,0,0]
		},
		// 4-7 (primary material)
		{
			diffuse: [1,1.0,0.9,1.0]
		},
		{
			diffuse: [1,0.9,0.8,1.0]
		},
		{
			diffuse: [1,0.8,0.7,1.0]
		},
		{
			diffuse: [1,0.7,0.8,1.0]
		}
	];
	
	this.lights = [
		{
			direction: [1,2,1],
			color: [0.3, 0.5, 0.5],
			shadowFuzz: 0.3,
			minimumShadowLight: 0.05
		},
		{
			direction: [-1,-2,-1],
			color: [0.1, 0.01, 0.01],
			shadowFuzz: 0.3,
			minimumShadowLight: 0.1
		}
	];
};

var normalizeLight = function(light) {
	light = DeepFreezer.thaw(light);
	light.direction = normalizeVect3d(light.direction);
	light.traceVector = normalizeVect3dToXYUnitSquare(light.direction);
	return light;
};

var mapEnumerable = function(obj, callback) {
	var i;
	var res = {};
	for( i in obj ) {
		if( i == 'length' ) {
			console.log("Warning: 'length' was enumerable!");
			continue;
		}
		res[i] = callback(obj[i]);
	}
	return res;
};

Object.defineProperty(ShapeSheetRenderer.prototype, "lights", {
	"get": function() { return this._lights; },
	"set": function(lights) {
		if( Object.is(lights, this._lights) ) return;
		
		this._lights = DeepFreezer.deepFreeze(mapEnumerable(lights, normalizeLight));
		this.lightsUpdated();
	}
});

/**
 * Slightly more efficient method for updating some lights
 * (since unchanged ones don't need to be re-normalized) 
 */
ShapeSheetRenderer.prototype.putLights = function(updatedLights) {
	var lights = DeepFreezer.thaw(this._lights);
	for( var i in updatedLights ) {
		lights[i] = DeepFreezer.deepFreeze(normalizeLight(updatedLights[i]));
	}
	this.lights = DeepFreezer.deepFreeze(lights, true);
};

ShapeSheetRenderer.prototype.normalizeLight = normalizeLight;

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

ShapeSheetRenderer.prototype.calculateDepthDerivedData = function(minX, minY, w, h) {
	var ss = this.shapeSheet;
	var width = ss.width, height = ss.height;
	var maxX = minX+w, maxY = minY+h;
	if( minX < 0 ) minX = 0;
	if( maxX > width ) maxX = width;
	if( minY < 0 ) minY = 0;
	if( maxY > height ) maxY = height;
	w = maxX-minX, h = maxY-minY;
	if( w <= 0 || h <= 0 ) return;
	
	var isFullRerender = (minX == 0 && minY == 0 && w == width && h == height);
	
	var i, x, y;
	var cornerDepths = ss.cellCornerDepths;
	var averageDepths = ss.cellAverageDepths;
	var minimumAverageDepth = isFullRerender ? Infinity : ss.minimumAverageDepth;
	
	var cellCoverages = ss.cellCoverages;
	var cellNormals = ss.cellNormals;

	for( y=minY; y<maxY; ++y ) for( x=minX, i=width*y+x; x<maxX; ++x, ++i ) {
		var z0 = cornerDepths[i*4+0],
		    z1 = cornerDepths[i*4+1],
		    z2 = cornerDepths[i*4+2],
		    z3 = cornerDepths[i*4+3];
		
		var tot = 0, cnt = 0;
		if( z0 !== Infinity ) { tot += z0; ++cnt; }
		if( z1 !== Infinity ) { tot += z1; ++cnt; }
		if( z2 !== Infinity ) { tot += z2; ++cnt; }
		if( z3 !== Infinity ) { tot += z3; ++cnt; }
		var avg = averageDepths[i] = (cnt == 0) ? Infinity : tot/cnt;
		if( avg < minimumAverageDepth ) minimumAverageDepth = avg;
		
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
	
	ss.minimumAverageDepth = minimumAverageDepth;
};

ShapeSheetRenderer.prototype.updateDepthDerivedData = function() {
	processRectangleUpdates(this.updatingDepthRectangles, this.calculateDepthDerivedData.bind(this));
};

ShapeSheetRenderer.prototype.calculateCellColors = function(minX, minY, w, h) {
	var ss = this.shapeSheet;
	var width = ss.width, height = ss.height;
	var maxX = minX+w, maxY = minY+h;
	if( minX < 0 ) minX = 0;
	if( maxX > width ) maxX = width;
	if( minY < 0 ) minY = 0;
	if( maxY > height ) maxY = height;
	w = maxX-minX, h = maxY-minY;
	if( w <= 0 || h <= 0 ) return;
	
	var i, l, x, y, d;
	var stx, sty, stz, stdx, stdy, stdz; // shadow tracing
	var cellColors = ss.cellColors;
	var cellCoverages = ss.cellCoverages;
	var cellNormals = ss.cellNormals;
	var materials = this.materials;
	var cellMaterialIndexes = ss.cellMaterialIndexes;
	var cellAvgDepths = ss.cellAverageDepths;
	var minAvgDepth = ss.minimumAverageDepth;
	var lights = this.lights;
	var shadowsEnabled = !!this.shadowsEnabled;
	var light;
	
	for( i=0, y=minY; y<maxY; ++y ) for( x=minX, i=width*y+x; x<maxX; ++x, ++i ) {
		var mat = materials[cellMaterialIndexes[i]];
		if( mat == null ) {
			console.log("No such material #"+cellMaterialIndexes[i]);
			continue;
		}
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
				if( shadowsEnabled && diffuseAmt > 0 ) {
					var shadowLight = 1;
					stx = x + 0.5;
					sty = y + 0.5;
					stz = cellAvgDepths[i];
					stdx = -light.traceVector[0];
					stdy = -light.traceVector[1];
					stdz = -light.traceVector[2];
					if( stdx == 0 && stdy == 0 ) {
						shadowLight = stdz < 0 ? 1 : 0;
					} else while( stz > minAvgDepth && stx > 0 && stx < width && sty > 0 && sty < height ) {
						d = cellAvgDepths[(sty|0)*width + (stx|0)];
						if( stz > d ) {
							shadowLight *= Math.pow(light.shadowFuzz, stz - d);
							stz = d;
						}
						stx += stdx; sty += stdy; stz += stdz;
					}
					diffuseAmt *= Math.max(shadowLight, light.minimumShadowLight);
				}
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
		this.shaders[s](ss, minX, minY, w, h);
	}
};

ShapeSheetRenderer.prototype.updateCellColors = function() {
	this.updateDepthDerivedData();
	if( this.shadowsEnabled ) {
		// Then you have to recalculate everything, brah
		var ss = this.shapeSheet;
		this.updatingColorRectangles.splice(0, this.updatingColorRectangles.length, [0,0,ss.width,ss.height]);
	}
	processRectangleUpdates(this.updatingColorRectangles, this.calculateCellColors.bind(this));
};

ShapeSheetRenderer.prototype.copyToCanvas = function(minX,minY,w,h) {
	var ss = this.shapeSheet;
	var width = ss.width, height = ss.height;
	var maxX = minX+w, maxY = minY+h;
	if( minX < 0 ) minX = 0;
	if( maxX > width ) maxX = width;
	if( minY < 0 ) minY = 0;
	if( maxY > height ) maxY = height;
	w = maxX-minX, h = maxY-minY;
	if( w <= 0 || h <= 0 ) return;
	
	if( this.canvas === null ) return;
	
	var ctx = this.canvas.getContext('2d');
	var encodeColorValue = function(i) {
		var c = Math.pow(i, 0.45);
		if( c > 1 ) return 255;
		return (c*255)|0;
	};
	var cellColors = ss.cellColors;
	
	var imgData = ctx.getImageData(minX, minY, w, h);
	var imgDataData = imgData.data;

	var bi, idi, x, y;
	for( idi=0, y=minY; y<maxY; ++y ) {
		for( x=minX, bi=width*y+x; x<maxX; ++x, ++bi, ++idi ) {
			imgDataData[idi*4+0] = encodeColorValue(cellColors[bi*4+0]);
			imgDataData[idi*4+1] = encodeColorValue(cellColors[bi*4+1]);
			imgDataData[idi*4+2] = encodeColorValue(cellColors[bi*4+2]);
			imgDataData[idi*4+3] = cellColors[bi*4+3] * 255;
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

ShapeSheetRenderer.prototype.updateCanvas = function() {
	var i, r;
	this.updateCellColors();
	processRectangleUpdates(this.updatingCanvasRectangles, this.copyToCanvas.bind(this));
};

ShapeSheetRenderer.prototype.requestCanvasUpdate = function() {
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

ShapeSheetRenderer.prototype.dataUpdated = function(x, y, w, h, updatedDepth, updatedMaterial) {
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

ShapeSheetRenderer.prototype.lightsUpdated = function() {
	var ss = this.shapeSheet;
	if( ss == null ) return;
	// Gotta recalculate everything!
	addToUpdateRectangleList(this.updatingColorRectangles, 0, 0, ss.width, ss.height);
	addToUpdateRectangleList(this.updatingCanvasRectangles, 0, 0, ss.width, ss.height);
};

//// Shader constructors

ShapeSheetRenderer.makeFogShader = function(originDepth, fogR, fogG, fogB, fogA) {
	return function(ss, minX, minY, w, h) {
		minX = minX|0; minY = minY|0; w = w|0; h = h|0;
		var maxX=(minX+w)|0, maxY=(minY+h)|0;
		var width = ss.width;
		var cellAverageDepths = ss.cellAverageDepths;
		var cellColors = ss.cellColors;
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

module.ShapeSheetRenderer = ShapeSheetRenderer;

})();
