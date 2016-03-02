var module = window;

var CanvasWorldView = function() {
};
CanvasWorldView.prototype.initUi = function(canvas) {
	this.canvas = canvas;
};

var ImageSlice = function(image, sx, sy, sw, sh) {
	this.image = image;
	this.sx = sx;
	this.sy = sy;
	this.sw = sw;
	this.sh = sh;
};

var drawSlice = function(slice, ctx, x, y, w, h) {
	if( w == null ) w = slice.sw;
	if( h == null ) h = slice.sh;
	// Only do smoothing to downscale, not to upscale:
	ctx.imageSmoothingEnabled = w < slice.sw;

	ctx.drawImage(slice.image, slice.sx, slice.sy, slice.sw, slice.sh, x, y, w, h);
};

CanvasWorldView.prototype.drawFrame = function(time) {
	var ctx = this.canvas.getContext("2d");
	var focusScreenX = this.canvas.width / 2;
	var focusScreenY = this.canvas.height / 2;
	
	var x = 16*10 + Math.cos( time * 0.01 ) * 64;
	var y = 16*10 + Math.sin( time * 0.01 ) * 64;
	
	var fogColor = [64,96,128,0.5]; // Last component is alpha per distance unit
	ctx.fillStyle = 'rgb('+fogColor[0]+','+fogColor[1]+','+fogColor[2]+')';
	ctx.fillRect(0,0,this.canvas.width, this.canvas.height);
	
	var i, d;
	var dists = [10.0, 8.0, 6.0, 4.0, 3.0, 2.5, 2.0, 1.6, 1.3, 1.1, 1.0];
	var dist, prevDist = null;
	for( d=0; d<dists.length; ++d ) {
		dist = dists[d] + Math.sin(time * 0.015 );
		
		for( i=0; i<this.sprites.length; ++i ) {
			var sprite = this.sprites[i];
			var slice = sprite.imageSlice;
			var screenX = focusScreenX + (sprite.x - x)/dist;
			var screenY = focusScreenY + (sprite.y - y)/dist;
			var sliceW = slice.sw/dist;
			var sliceH = slice.sh/dist;
			
			drawSlice(slice, ctx, screenX|0, screenY|0, Math.ceil(sliceW)|0, Math.ceil(sliceH)|0);
			//drawSlice(slice, ctx, screenX|0, screenY|0, sliceW, sliceH);
			//drawSlice(slice, ctx, screenX, screenY, sliceW, sliceH);
		}
		
		if( prevDist !== null && dist > 1 ) {
			// TODO: Better fog calculation
			var fogLayerAlpha = Math.pow(fogColor[3], 1.0/(prevDist-dist));
			ctx.fillStyle = 'rgba('+fogColor[0]+','+fogColor[1]+','+fogColor[2]+','+fogLayerAlpha+')';
			ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
			//ctx.fillStyle = 'rgba(0,0,0,1)';
		}
		prevDist = dist;
	}
};

CanvasWorldView.prototype.animate = function() {
	var requestAnimationCallback = (function() {
		window.requestAnimationFrame(animationCallback);
	});
	var i = 0;
	var fps = 0;
	var animationCallback = (function() {
		this.drawFrame(i++);
		setTimeout(requestAnimationCallback, 1000 / 100);
		++fps;
	}).bind(this);
	setInterval(function() { console.log("FPS: "+fps); fps = 0; }, 1000);
	
	window.requestAnimationFrame(animationCallback);
};

CanvasWorldView.prototype.runDemo2 = function() {
	this.animate();
};
CanvasWorldView.prototype.runDemo = function() {
	this.spriteSheet = new Image();
	this.spriteSheet.src = 'SomeTiles.png';

	var brickImage = new ImageSlice(this.spriteSheet, 0, 0, 16, 16);
	var blockImage = new ImageSlice(this.spriteSheet, 0, 16, 16, 16);
	var x, y;
	this.sprites = [];
	for( y=0; y<20; ++y ) {
		for( x=0; x<20; ++x ) {
			if( Math.random() < 0.5 ) {
				this.sprites.push({
					imageSlice: Math.random() < 0.5 ? brickImage : blockImage,
					x: x * 16,
					y: y * 16
				});
			}
		}
	}
	
	this.spriteSheet.addEventListener('load', this.runDemo2.bind(this) );
};

module.CanvasWorldView = CanvasWorldView;
