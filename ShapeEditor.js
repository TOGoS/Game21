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
			color: [0.7, 0.9, 1]
		},
		{
			direction: [-1,-2,-1],
			color: [0.5, 0.2, 0.2]
		}
	];
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
ShapeEditor.prototype.calculateCellColors = function() {
	var i, l;
	var cornerDepths = this.cellCornerDepths;
	var cellColors = this.cellColors;
	var lights = this.lights;
	var light;
	for( i=0; i<this.width*this.height; ++i ) {
		var mat = this.materials[this.cellMaterialIndexes[i]];
		// Z being 'into' the picture (right-handed coordinate system!)
		// Maybe this will work!
		var dzdx = (
			(cornerDepths[i*4+1] - cornerDepths[i*4+0]) + 
			(cornerDepths[i*4+3] - cornerDepths[i*4+2])) / 2;
		var dzdy = (
			(cornerDepths[i*4+2] - cornerDepths[i*4+0]) + 
			(cornerDepths[i*4+3] - cornerDepths[i*4+1])) / 2;
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
		cellColors[i*4+3] = mat.diffuse[3];
		for( l in lights ) {
			light = this.lights[l];
			var dotProd = -(normalX*light.direction[0] + normalY*light.direction[1] + normalZ*light.direction[2]);
			if( dotProd > 0 ) {
				var amt = dotProd; // Probably need to use angle somehow instead
				cellColors[i*4+0] += amt * light.color[0] * mat.diffuse[0];
				cellColors[i*4+1] += amt * light.color[1] * mat.diffuse[1];
				cellColors[i*4+2] += amt * light.color[2] * mat.diffuse[2];
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
		var sphereX = (x - this.width/2.0) / (this.width/2.0);
		var sphereY = (y - this.height/2.0) / (this.height/2.0);
		// 1 = Math.sqrt(sphereX**2 + sphereY**2 + sphereZ**2)
		// 1 = sphereX**2 + sphereY**2 + sphereZ ** 2
		// 1 - sphereZ**2 = sphereX**2 + sphereY**2
		// -sphereZ**2 = sphereX**2 + sphereY**2 - 1
		// sphereZ**2 = 1 - (sphereX**2 + sphereY**2)
		var h = 1 - (sphereX*sphereX + sphereY*sphereY);
		if( h < 0 ) return -Infinity;
		
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
	
	this.renderPreviews();
};

module.ShapeEditor = ShapeEditor;
