(function() {
"use strict";

var module = window;

var ShapeSheetDemo = function(shapeSheetUtil) {
	this.shapeSheetUtil = shapeSheetUtil;
};

Object.defineProperty(ShapeSheetDemo.prototype, "shapeSheet", {
	"get": function() { return this.shapeSheetUtil.shapeSheet; },
	"set": function(ss) { this.shapeSheetUtil.shapeSheet = ss; }
});
Object.defineProperty(ShapeSheetDemo.prototype, "renderer", {
	"get": function() { return this.shapeSheetUtil.renderer; },
	"set": function(ss) { this.shapeSheetUtil.renderer = ss; }
});

ShapeSheetDemo.prototype.buildDemo = function() {
	var width = this.shapeSheetUtil.shapeSheet.width;
	var height = this.shapeSheetUtil.shapeSheet.height;
	var util = this.shapeSheetUtil;
	var minwh = Math.min(width,height);
	
	util.plotSphere(width/2, height/2, minwh*2, minwh/4);
	util.plotSphere(width/2, height/2, minwh*1, minwh/8);
	util.plotSphere(width/2, height/2, minwh*0.5, minwh/16);
	var i;
	for( i=0; i<200; ++i ) {
		var r = 2 * Math.PI * i / 200;
		util.plotSphere(
			width/2  + Math.cos(r)*minwh*(3.0/8),
			height/2 + Math.sin(r)*minwh*(3.0/8),
			width/2,
			minwh/8);
	}
	
	for( i=0; i<200; ++i ) {
		util.plotSphere(Math.random()*width, Math.random()*height, Math.random()*8 + 128, 8);
	}
	
	util.plotAABeveledCuboid(15, 15, 15, 48, 48, 4);
	util.plotAABeveledCuboid(10, 10, 0, 32, 32, 4);
	util.plotAABeveledCuboid(16, 16, -6, 8, 8, 2);
	util.plotSphere(26, 26, 0, 8);
	util.plotSphere(42, 36, 10, 10);
	util.plotSphere(42, 14, 24, 10);
};

ShapeSheetDemo.prototype.animateLights = function() {
	var lightsMoving = true;
	var renderer = this.renderer;
	var lights   = renderer.lights;
	if( lights.length < 2 ) {
		console.log("Not enough lights to animate!");
	}
	var f = 0;
	return setInterval( (function() {
		if( lightsMoving ) {
			if( lights[0] ) renderer.lights[0].direction = [+Math.sin(f*0.01),  0.8, +Math.cos(f*0.01)];
			if( lights[1] ) lights[1].direction = [-Math.sin(f*0.005), -0.8, -Math.cos(f*0.005)];
			renderer.lightsUpdated();
			++f;
		}
		renderer.requestCanvasUpdate();
	}).bind(this), 1000 / 60);
};

ShapeSheetDemo.prototype.animateLavaLamp = function() {
	var ss = this.shapeSheet;
	var x = ss.width/2, y = ss.width/2, rad = Math.random()*ss.width/8;
	var vx = 1, vy = 1, vrad = 0;
	var ang = 0;
	return setInterval((function() {
		var util = this.shapeSheetUtil;
		var renderer = util.renderer;
		var ss = this.shapeSheet;
		var width = ss.width;
		var height = ss.height;
		
		rad = Math.abs(rad + vrad);
		if( rad <  4 ) { rad = 4; vrad = +1; }
		var maxRad = Math.min(width/4, 16);
		if( rad > maxRad ) { rad = maxRad; vrad = -1; }
		
		x += vx;
		y += vy;
		if(      x-rad <= 0      ) { x = rad       ; vx = +Math.abs(vx); }
		else if( x+rad >= width  ) { x = width-rad ; vx = -Math.abs(vx); }
		if(      y-rad <= 0      ) { y = rad       ; vy = +Math.abs(vy); }
		else if( y+rad >= height ) { y = height-rad; vy = -Math.abs(vy); }
		if( Math.abs(vx) > 1 ) vx *= 0.5;
		if( Math.abs(vy) > 1 ) vy *= 0.5;
		
		vx   += Math.random()-0.5;
		vy   += Math.random()-0.5;
		
		vrad += Math.random()-0.5;
		if( Math.abs(vrad) > 1 ) vrad *= 0.5;

		util.shiftZ(1);
		var vMag = Math.sqrt(vx*vx + vy*vy);
		var aheadX = vx / vMag, aheadY = vy / vMag;
		var sideX  = aheadY   , sideY = -aheadX;
		var loopRad = width/8;
		var sin = Math.sin(ang);
		var cos = Math.cos(ang);
		var plotX = x + sin * sideX * loopRad;
		var plotY = plotY = y + sin * sideY * loopRad;
		var plotZ = 0 + cos * loopRad;
		
		util.plotSphere(plotX, plotY, plotZ, rad);
		
		renderer.requestCanvasUpdate();
		
		ang += Math.PI / 16;
	}).bind(this), 10);
};

ShapeSheetDemo.prototype.animateLightning = function() {
	var bolts = {lightning0:-Infinity, lightning1:-Infinity, lightning2:-Infinity};
	setInterval( (function() {
		var lightsNeedNormalizing = false;
		var lightLevelsChanged = false;
		var i, level;
		for( i in bolts ) {
			level = bolts[i];
			if( level === -Infinity ) {
				if( Math.random() < 0.01 ) {
					level = 1;
					bolts[i] = Math.random();
					this.renderer.lights[i] = {
						direction: [Math.random()-0.5, Math.random()-0.5, Math.random()-0.5],
						color: [level,level,level],
						shadowFuzz: 0.5,
						minimumShadowLight: 0.1
					};
					lightsNeedNormalizing = true;
					lightLevelsChanged = true;
				}
			} else {
				if( Math.random() < 0.1 ) {
					level *= 2;
				} else {
					level *= Math.random();
				}
				this.renderer.lights[i].color = [level,level,level];
				lightLevelsChanged = true;
				if( level < 0.001 ) {
					bolts[i] = -Infinity;
					delete this.renderer.lights[i];
				} else {
					bolts[i] = level;
				}
			}
		}
		if( lightLevelsChanged ) this.renderer.lightsUpdated();
		else if( lightsNeedNormalizing ) this.renderer.normalizeLights();
	}).bind(this), 10);
};

module.ShapeSheetDemo = ShapeSheetDemo;

})();
