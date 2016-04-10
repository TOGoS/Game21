import ShapeSheet from './ShapeSheet';
import ShapeSheetTransforms from './ShapeSheetTransforms';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil from './ShapeSheetUtil';
import DirectionalLight from './DirectionalLight';
import KeyedList from './KeyedList';
import Material from './Material';
import Vector3D from './Vector3D';
import ImageSlice from './ImageSlice';
import {DEFAULT_LIGHTS} from './Lights';
import {DEFAULT_MATERIALS} from './Materials';
import Rectangle from './Rectangle';

// This is old code from before
// a lof of things had been figured out.
// It needs rewriting or just straight up deleting.
// But I wanted to make it work again because it seemed easier that starting over.

class Slicer {
	public lights:KeyedList<DirectionalLight> = DEFAULT_LIGHTS;
	public materials:Array<Material> = DEFAULT_MATERIALS;
	
	public slice( ss:ShapeSheet, x:number, y:number, w:number, h:number, flipX:boolean, rot:number ):ImageSlice<HTMLImageElement> {
		const transformed:ShapeSheet = ShapeSheetTransforms.clone(ss, x, y, w, h, flipX, rot);
		const image:HTMLImageElement = ShapeSheetRenderer.shapeSheetToImage( transformed, this.materials, this.lights );
		return new ImageSlice<HTMLImageElement>( image, new Vector3D(w/2, h/2, w/2), 1, new Rectangle(0,0,w,h) );
	}
}

class Sprite {
	public imageSlice:ImageSlice<HTMLImageElement>;
	public x:number;
	public y:number;
	public z:number;
}

class CanvasWorldView {
	protected canvas:HTMLCanvasElement;
	protected sprites:Array<Sprite> = [];
	
	public initUi(canvas) {
		this.canvas = canvas;
	};

	protected drawSlice(slice:ImageSlice<HTMLImageElement>, ctx:CanvasRenderingContext2D, x:number, y:number, w:number, h:number) {
		if( w == null ) w = slice.bounds.width;
		if( h == null ) h = slice.bounds.height;
		// Only do smoothing to downscale, not to upscale:
		ctx['imageSmoothingEnabled'] = w < slice.bounds.width;
		
		ctx.drawImage(slice.sheet, slice.bounds.minX, slice.bounds.minY, slice.bounds.width, slice.bounds.height, x, y, w, h);
	};

	protected drawFrame(time) {
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
		for( d=0; d < dists.length; ++d ) {
			dist = dists[d];// + Math.sin(time * 0.015 );
			
			for( i=0; i < this.sprites.length; ++i ) {
				var sprite = this.sprites[i];
				var slice = sprite.imageSlice;
				var screenX = focusScreenX + (sprite.x - x)/dist;
				var screenY = focusScreenY + (sprite.y - y)/dist;
				var sliceW = slice.bounds.width/dist;
				var sliceH = slice.bounds.height/dist;
				
				this.drawSlice(slice, ctx, screenX|0, screenY|0, Math.ceil(sliceW)|0, Math.ceil(sliceH)|0);
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
	}

	protected animate() {
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
		//setInterval(function() { console.log("FPS: "+fps); fps = 0; }, 1000);
		
		window.requestAnimationFrame(animationCallback);
	};

	protected runDemo() {
		this.animate();
	};
	public runDemo2() {
		var ss = new ShapeSheet(16,16);
		var util = new ShapeSheetUtil(ss);
		var slicer = new Slicer();
		util.plotAABeveledCuboid( 0, 0, 0, 16, 16, 2 );
		util.plotSphere(  4, 4, 0.5, 1.5 );
		util.plotSphere(  8, 4, 0.5, 1.5 );
		slicer.lights = {
			"primary": DirectionalLight.createFrom({
				direction: [1,2,1],
				color: [0.3, 0.5, 0.5],
				shadowFuzz: 0.3,
				shadowDistance: 16
			}),
			"ambient": DirectionalLight.createFrom({
				direction: [0,0,1],
				color: [0.01, 0.01, 0.01],
				shadowFuzz: 0.3,
				shadowDistance: 16,
			}),
			"back": DirectionalLight.createFrom({
				direction: [-2,-1,-1],
				color: [0.06, 0.1, 0.08],
				shadowFuzz: 0.3,
				shadowDistance: 16,
			})
		};
		
		var blockImages:Array<ImageSlice<HTMLImageElement>> = [];
		var flipX, rot;
		for( flipX=0; flipX < 2; ++flipX ) {
			for( rot=0; rot < 360; rot+=90 ) {
				blockImages.push(slicer.slice( ss, 0, 0, 16, 16, flipX == 1, rot ));
			}
		}
		
		var x, y;
		for( y=0; y < 20; ++y ) {
			for( x=0; x < 20; ++x ) {
				if( Math.random() < 0.5 ) {
					this.sprites.push({
						imageSlice: blockImages[(Math.random()*blockImages.length)|0],
						x: x * 16,
						y: y * 16,
						z: 0
					});
				}
			}
		}
		
		this.runDemo();
	}
}

export default CanvasWorldView;
