(function() {

var module = window;

var LARGE_NUMBER = 1000;

var normalizeVect3d = function(vect) {
	var len = Math.sqrt(vect[0]*vect[0] + vect[1]*vect[1] + vect[2]*vect[2]);
	return [vect[0]/len, vect[1]/len, vect[2]/len];
};

var ShapeEditor = function(width,height) {
	this.initBuffer(width,height);
};
ShapeEditor.prototype.initBuffer = function(width,height) {
	this.width = width|0;
	this.height = height|0;
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
	this.cellColors          = new Float32Array(cellCount*4); // r,g,b,a of each cell after shading
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

ShapeEditor.prototype.calculateCellDepthDerivedData = function() {
	var i;
	var cornerDepths = this.cellCornerDepths;
	
	var cellCoverages = this.cellCoverages;
	var cellNormals = this.cellNormals;
	
	for( i=this.width*this.height-1; i>=0; --i ) {
		var z0 = cornerDepths[i*4+0],
		    z1 = cornerDepths[i*4+1],
		    z2 = cornerDepths[i*4+2],
		    z3 = cornerDepths[i*4+3];
		
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

ShapeEditor.prototype.calculateCellColors = function() {
	var i, l;
	var cellColors = this.cellColors;
	var cellCoverages = this.cellCoverages;
	var cellNormals = this.cellNormals;
	var materials = this.materials;
	var cellMaterialIndexes = this.cellMaterialIndexes;
	var lights = this.lights;
	var light;
	for( i=this.width*this.height-1; i>=0; --i ) {
		var mat = materials[cellMaterialIndexes[i]];
		// Z being 'into' the picture (right-handed coordinate system!)
		
		var normalX = cellNormals[i*3+0],
		    normalY = cellNormals[i*3+1],
		    normalZ = cellNormals[i*3+2];
		
		cellColors[i*4+0] = 0;
		cellColors[i*4+1] = 0;
		cellColors[i*4+2] = 0;
		cellColors[i*4+3] = mat.diffuse[3] * cellCoverages[i] * 0.25;
		for( l in lights ) {
			light = lights[l];
			var dotProd = -(normalX*light.direction[0] + normalY*light.direction[1] + normalZ*light.direction[2]);
			if( dotProd > 0 ) {
				var diffuseAmt = dotProd; // Yep, that's how you calculate it.
				cellColors[i*4+0] += diffuseAmt * light.color[0] * mat.diffuse[0];
				cellColors[i*4+1] += diffuseAmt * light.color[1] * mat.diffuse[1];
				cellColors[i*4+2] += diffuseAmt * light.color[2] * mat.diffuse[2];
			}
		}
	}
};
ShapeEditor.prototype.copyToCanvas = function() {
	var ctx = this.previewCanvas.getContext('2d');
	var imgData = ctx.getImageData(0, 0, this.previewCanvas.width, this.previewCanvas.height);
	var imgDataData = imgData.data;
	var i;
	var encodeColorValue = function(i) {
		var c = Math.pow(i, 0.45);
		if( c > 1 ) return 255;
		return (c*255)|0;
	};
	var cellColors = this.cellColors;
	for( i=0; i<this.width*this.height; ++i ) {
		imgDataData[i*4+0] = encodeColorValue(cellColors[i*4+0]);
		imgDataData[i*4+1] = encodeColorValue(cellColors[i*4+1]);
		imgDataData[i*4+2] = encodeColorValue(cellColors[i*4+2]);
		imgDataData[i*4+3] = this.cellColors[i*4+3] * 255;
	}
	ctx.putImageData(imgData, 0, 0);
};
ShapeEditor.prototype.renderPreviews = function() {
	this.normalizeLights();
	this.calculateCellDepthDerivedData();
	this.calculateCellColors();
	this.copyToCanvas();
};
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
};

ShapeEditor.prototype.runDemo = function() {
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
	
	this.calculateCellDepthDerivedData();
	
	var f = 0, fps = 0;
	var animationCallback = (function() {
		this.lights[0].direction = [+Math.sin(f*0.01),  0.8, +Math.cos(f*0.01)];
		this.lights[1].direction = [-Math.sin(f*0.005), -0.8, -Math.cos(f*0.005)];
		this.normalizeLights();
		this.calculateCellColors();
		this.copyToCanvas();
		setTimeout(requestAnimationCallback, 1); // As often as possible, basically
		++f;
		++fps;
	}).bind(this);
	var requestAnimationCallback = function() {
		window.requestAnimationFrame(animationCallback);
	};
	setInterval(function() { console.log("FPS: "+fps); fps = 0; }, 1000);
	requestAnimationCallback();
};

module.ShapeEditor = ShapeEditor;

})();
