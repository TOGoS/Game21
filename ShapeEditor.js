var module = window;

var normalizeVect3d = function(vect) {
	var len = Math.sqrt(vect[0]*vect[0] + vect[1]*vect[1] + vect[2]*vect[2]);
	return [vect[0]/len, vect[1]/len, vect[2]/len];
};

var ShapeEditor = function() {
	this.width = 64;
	this.height = 64;
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
	this.cellMaterialIndexes = new Uint16Array(this.width*this.height);
	this.cellCornerDepths = new Float32Array(this.width*this.height*4); // Depth (in pixels)
	this.cellColors = new Float32Array(this.width*this.height*4); // r,g,b,a of each cell after shading
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
			return 9999;
		} else if( s1 === -Infinity ) {
			return 0;
		} else {
			return s1;
		}
	} else if( s0 === -Infinity ) {
		if( s1 === Infinity ) {
			return 0;
		} else if( s1 === -Infinity ) {
			return -9999;
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

ShapeEditor.prototype.calculateCellColors = function() {
	var i, l;
	var cornerDepths = this.cellCornerDepths;
	var cellColors = this.cellColors;
	var lights = this.lights;
	var light;
	for( i=0; i<this.width*this.height; ++i ) {
		var mat = this.materials[this.cellMaterialIndexes[i]];
		// Z being 'into' the picture (right-handed coordinate system!)
		
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
		cellColors[i*4+0] = 0;
		cellColors[i*4+1] = 0;
		cellColors[i*4+2] = 0;
		cellColors[i*4+3] = mat.diffuse[3] * opac;
		for( l in lights ) {
			light = this.lights[l];
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
ShapeEditor.prototype.renderPreviews = function() {
	var ctx = this.previewCanvas.getContext('2d');
	var imgData = ctx.getImageData(0, 0, this.previewCanvas.width, this.previewCanvas.height);
	var imgDataData = imgData.data;
	var i;
	this.calculateCellColors();
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
ShapeEditor.prototype.runDemo = function() {
	var i;
	var sphereDepth = (function(x,y) {
		var sphereX = (x - this.width/2.0) / ((this.width+0.5)/2.0);
		var sphereY = (y - this.height/2.0) / ((this.height+0.5)/2.0);
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
			this.cellMaterialIndexes[i] = (Math.random()*3)|0;
			this.cellCornerDepths[i*4+0] = sphereDepth(x+0,y+0);
			this.cellCornerDepths[i*4+1] = sphereDepth(x+1,y+0);
			this.cellCornerDepths[i*4+2] = sphereDepth(x+0,y+1);
			this.cellCornerDepths[i*4+3] = sphereDepth(x+1,y+1);
		}
	}
	var f = 0, fps = 0;
	var animationCallback = (function() {
		this.lights[0].direction = [+Math.sin(f*0.01),  0.8, +Math.cos(f*0.01)];
		this.lights[1].direction = [-Math.sin(f*0.005), -0.8, -Math.cos(f*0.005)];
		this.normalizeLights();
		this.renderPreviews();
		setTimeout(requestAnimationCallback, 1000 / 100);
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
