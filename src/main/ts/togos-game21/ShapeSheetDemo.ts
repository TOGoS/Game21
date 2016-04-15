import DeepFreezer from './DeepFreezer';
import Vector3D from './Vector3D';
import Cuboid from './Cuboid';
import LightColor from './LightColor';
import ShapeSheet from './ShapeSheet';
import DirectionalLight from './DirectionalLight';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil, {NOOP_PLOTTED_DEPTH_FUNCTION} from './ShapeSheetUtil';
import SimplexNoise from '../SimplexNoise';
import DensityFunction3D, {makeDensityFunction} from './DensityFunction3D';

class ShapeSheetDemo {
	public shapeSheetUtil:ShapeSheetUtil;
	public shifting:boolean;
	public simplexScale:number=1;
	
	constructor(shapeSheetUtil:ShapeSheetUtil) {
		this.shapeSheetUtil = shapeSheetUtil;
		this.shifting = false;
	};
	
	get shapeSheet() { return this.shapeSheetUtil.shapeSheet; }
	get renderer() { return this.shapeSheetUtil.renderer; }

	public buildStandardDemoShapes() {
		var util = this.shapeSheetUtil;

		var width = util.shapeSheet.width;
		var height = util.shapeSheet.height;
		var minwh = Math.min(width,height);
		
		const simplex = new SimplexNoise(Math.random);
		const clamp = (min,num,max) => Math.max(min,Math.min(num,max));
		const sxs = this.simplexScale;
		
		const layeredSimplex4 = (x,y,z) =>
			simplex.noise3d(x/2, y/2, z/2) * 0.25 +
			simplex.noise3d(x/5, y/5, z/5) * 0.5 +
			simplex.noise3d(x/25, y/25, z/25) * 5 + 
			simplex.noise3d(x/50, y/50, z/50) * 15;
		util.plottedDepthFunction = sxs == 0 ?
			NOOP_PLOTTED_DEPTH_FUNCTION : (x,y,z) => (z == Infinity ? z : (z + layeredSimplex4(x/sxs, y/sxs, z/sxs) * sxs));
		util.plottedMaterialIndexFunction = (x,y,z) => clamp(8, 10+2*simplex.noise3d(x, y, z), 12)|0;
		util.plotAABeveledCuboid(0,0,minwh,width,height,0);
		
		const layeredSimplex2 = (x,y,z) =>
			simplex.noise3d(x/2, y/2, z/2) * 0.25 +
			simplex.noise3d(x/5, y/5, z/5) * 0.5;		
		util.plottedDepthFunction = sxs == 0 ?
			NOOP_PLOTTED_DEPTH_FUNCTION : (x,y,z) => (z == Infinity ? z : (z + layeredSimplex2(x/sxs, y/sxs, z/sxs) * sxs));
		util.plottedMaterialIndexFunction = (x,y,z) => clamp(4, 6+2*simplex.noise3d(x/4, y/4, z/4), 8)|0;
		
		util.plotSphere(width/2, height/2, minwh*2, minwh/4);
		util.plotSphere(width/2, height/2, minwh*1, minwh/8);
		util.plotSphere(width/2, height/2, minwh*0.5, minwh/16);
		var i;
		for( i=0; i < 200; ++i ) {
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
		util.plotAASharpBeveledCuboid(10, 10, 0, 32, 32, 4);
		util.plotAABeveledCuboid(16, 16, -6, 8, 8, 2);
		util.plotSphere(26, 26, 0, 8);
		util.plotSphere(42, 36, 10, 10);
		util.plotSphere(42, 14, 24, 10);
	};
	
	public grainSize:number = 10;
	
	public buildDensityFunctionDemoShapes() {
		const w = this.shapeSheet.width;
		const h = this.shapeSheet.height;
		var nsize = Math.max(64, Math.min(w, h));
		const plotX = w/2, plotY = h/2, plotZ = 0, rad = nsize/4;
		
		const simplex = new SimplexNoise(Math.random);
		
		const df:DensityFunction3D = makeDensityFunction( (x,y,z) => {
			const dx = x-plotX, dy = y-plotY, dz = z-plotZ;
			//return simplex.noise3d(x/rad,y/rad,z/rad) * 1;
			const sr = this.simplexScale * rad;
			return rad - Math.sqrt(dx*dx+dy*dy+dz*dz) + ((sr == 0) ? 0 : simplex.noise3d(x/sr, y/sr, z/sr) * sr);
		});
		
		const grain = (x,y,z) => {
			const xDiv = this.grainSize * 40;
			const v = simplex.noise3d(40 + x/xDiv, y/xDiv, z/xDiv)*40;
			return v - Math.floor(v);
		}
		
		this.shapeSheetUtil.plottedMaterialIndexFunction = (x,y,z) => {
			return 4 + (grain(x,y,z) * 4)|0;
		};
		this.shapeSheetUtil.plottedDepthFunction = (x,y,z) => {
			const grainIdx = (grain(x,y,z) * 4)|0;
			return z + ((grainIdx) == 0 ? +0.3 : 0);
		};
		const smallBounds = new Cuboid(plotX-rad*2, plotY-rad*2, plotZ-rad*2, plotX+rad*2, plotY+rad*2, plotZ+rad*2);
		const fullBounds = new Cuboid(0, 0, plotZ-rad*4, w, h, +plotZ+rad*4);
		this.shapeSheetUtil.plotDensityFunction(df, fullBounds, 20);
	}	
	
	public buildPolygonDemoShapes() {
		var util = this.shapeSheetUtil;
		var width = util.shapeSheet.width;
		var height = util.shapeSheet.height;
		var sides = 80;
		var s = 0;
		var l = 0;
		var cx = width/2, cy = height/2;
		for( l=0; l<30; ++l ) {
			if( l % 3 == 0 ) continue;
			for( s=0; s<sides; ++s ) {
				var a0 = s   * Math.PI*2/sides, a1 = (s+1) * Math.PI*2/sides;
				var s0 = Math.sin(a0), s1 = Math.sin(a1);
				var c0 = Math.cos(a0), c1 = Math.cos(a1);
				var d0 = l*3, d1=(l+1)*3;
				var z0 = 30 * Math.sin(  l    * 0.2 );
				var z1 = 30 * Math.sin( (l+1) * 0.2 );
				var points = [cx+c0*d0,cy+s0*d0,z0, cx+c0*d1,cy+s0*d1,z1, cx+c1*d1,cy+s1*d1,z1, cx+c1*d0,cy+s1*d0,z0];
				util.snapPoints(points, 8, 8, 16);
				util.plotConvexPolygon( points );
				console.log( c0*d0,s0*d0,z0, c0*d1,s0*d1,z1, c1*d1,s1*d1,z1, c1*d0,s1*d0,z0 );
				//util.plotSphere( c1*d1,s1*d1,z1, 3 );
			}
		}
		
	/*	//this one causes trouble
		var points = [
			7.725424859373686,23.776412907378838,14.38276615812609,
			9.270509831248424,28.531695488854606,16.939274201851063,
			-9.27050983124842 ,28.53169548885461 ,16.939274201851063,
			-7.725424859373684,23.77641290737884 ,14.38276615812609
		];
		util.plotConvexPolygon(points);
	*/
		
		//util.plotConvexPolygon( [30,29,0, 40,30,0, 45,40,0, 29,45,10] );
		
		//util.plotConvexPolygon( [32,16,0, 48,32,0, 32,48,0, 16,40,0, 16,24,0] );
	};

	public startLightRotation() {
		var lightsMoving = true;
		var renderer = this.renderer;
		var f = 0;
		return setInterval( (function() {
			if( lightsMoving ) {
				var lights = DeepFreezer.thaw(this.renderer.lights);
				if( lights["primary"] != null ) {
					lights["primary"] = new DirectionalLight(
						new Vector3D(+Math.sin(f*0.01), 0.8, +Math.cos(f*0.01)),
						lights["primary"].color, lights["primary"] );
				}
				if( lights["glow"] != null ) {
					lights["glow"] = new DirectionalLight(
						new Vector3D(-Math.sin(f*0.005), -0.8, -Math.cos(f*0.007)),
						lights["glow"].color, lights["glow"]);
				}
				renderer.lights = lights;
				++f;
			}
			renderer.requestCanvasUpdate();
		}).bind(this), 1000 / 60);
	};

	public startLavaLamp() {
		const ss:ShapeSheet = this.shapeSheet;
		let x = ss.width/2, y = ss.width/2, rad = Math.random()*ss.width/8;
		let vx = 1, vy = 1, vrad = 0;
		let ang = 0;
		let i = 0;
		return setInterval((function() {
			const util:ShapeSheetUtil = this.shapeSheetUtil;
			const renderer:ShapeSheetRenderer = util.renderer;
			const ss:ShapeSheet = this.shapeSheet;
			const width:number = ss.width;
			const height:number = ss.height;
			
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

			if( this.shifting ) util.shiftZ(1);
			var vMag = Math.sqrt(vx*vx + vy*vy);
			var aheadX = vx / vMag, aheadY = vy / vMag;
			var sideX  = aheadY   , sideY = -aheadX;
			var loopRad = width/8;
			var sin = Math.sin(ang);
			var cos = Math.cos(ang);
			var plotX = x + sin * sideX * loopRad;
			var plotY = plotY = y + sin * sideY * loopRad;
			var plotZ = 0 + cos * loopRad - (this.shifting ? 0 : i);
			
			util.plotSphere(plotX, plotY, plotZ, rad);
			/*
			const df:DensityFunction3D = makeDensityFunction( (x,y,z) => {
				const dx = x-plotX, dy = y-plotY, dz = z-plotZ;
				return rad - Math.sqrt(dx*dx+dy*dy+dz*dz) + simplex.noise3d(x/10,y/10,z/10);
			});
			
			util.plotDensityFunction(df, new Cuboid(plotX-rad*2, plotY-rad*2, plotZ-rad*2, plotX+rad*2, plotY+rad*2, plotZ+rad*2));
			*/
			
			renderer.requestCanvasUpdate();
			
			ang += Math.PI / 16;
			++i;
		}).bind(this), 10);
	};

	public startLightning() {
		var bolts = {lightning0:-Infinity, lightning1:-Infinity, lightning2:-Infinity};
		var lights = {};
		setInterval( (function() {
			var i, level;
			for( i in bolts ) {
				level = bolts[i];
				if( level === -Infinity ) {
					if( Math.random() < 0.01 ) {
						level = 1;
						bolts[i] = Math.random();
						lights[i] = DirectionalLight.createFrom({
							direction: new Vector3D(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5),
							color: new LightColor(level,level,level),
							shadowFuzz: 0.5,
							minimumShadowLight: 0.1
						});
					}
				} else {
					if( Math.random() < 0.1 ) {
						level *= 2;
					} else {
						level *= Math.random();
					}
					if( level < 0.001 ) {
						bolts[i] = -Infinity;
						delete lights[i];
					} else {
						if( lights[i] == null ) {
							console.log("Somehow lights["+i+"] doesn't exist; can't update lightning.", lights);
							continue;
						}
						lights[i] = new DirectionalLight( lights[i].direction, new LightColor(level,level,level), lights[i] );
						bolts[i] = level;
					}
				}
			}
			this.renderer.putLights(lights);
		}).bind(this), 10);
	};
}

import SurfaceColor from './SurfaceColor';
import FPSUpdater from './FPSUpdater';
declare var window:any;

function parseBool(s:string, defaultVal:boolean=null) {
	if( s == '' || s == null ) return defaultVal;
	s = s.toLowerCase();
	switch( s ) {
	case '1': case 'yes': case 'y': case 't': case 'true': case 'on' : return true;
	case '0': case 'no': case 'n': case 'f': case 'false': case 'off': return false;
	}
	throw new Error("Failed to parse '"+s+"' as boolean");
}

function parseNumber(s:string, defaultVal:number=null) {
	if( s == '' || s == null ) return defaultVal;
	return parseFloat(s);
}

export function buildShapeDemo(canv:HTMLCanvasElement) {
	const shapeSheet = new ShapeSheet(canv.width, canv.height);
	const shapeSheetRenderer = new ShapeSheetRenderer(shapeSheet, canv);
	shapeSheetRenderer.shaders.push(ShapeSheetRenderer.makeFogShader(0, new SurfaceColor(0, 0, 0, 0.01)));
	const shapeSheetUtil = new ShapeSheetUtil(shapeSheet, shapeSheetRenderer);
	const shapeSheetDemo = new ShapeSheetDemo(shapeSheetUtil);
	
	const fpsUpdater = new FPSUpdater(function() { return shapeSheetRenderer.canvasUpdateCount; }, document.getElementById('fps-counter').firstChild );
	fpsUpdater.start();
	
	return shapeSheetDemo;
}

export default ShapeSheetDemo;
