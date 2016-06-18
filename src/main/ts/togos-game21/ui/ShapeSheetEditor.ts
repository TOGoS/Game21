import { freeze } from '../DeepFreezer';
import KeyedList from '../KeyedList';
import DirectionalLight from '../DirectionalLight';
import Material from '../Material';
import ProceduralShape from '../ProceduralShape';
import Rectangle from '../Rectangle';
import Vector3D from '../Vector3D';
import Quaternion from '../Quaternion';
import TransformationMatrix3D from '../TransformationMatrix3D';
import ShapeSheet from '../ShapeSheet';
import ShapeSheetRenderer from '../ShapeSheetRenderer';
import ShapeSheetUtil from '../ShapeSheetUtil';
import { DEFAULT_MATERIAL_MAP } from '../materials';
import { DEFAULT_LIGHTS } from '../lights';

interface ViewAnimationSettings {
	animationSpeed : number; // change in t per second
	rotation : Quaternion; // unit rotation
	rotationSpeed : number; // how many unit rotation to do per second
}

class ShapeView {
	protected _shape : ProceduralShape;
	protected _t : number = 0;
	protected _xf : TransformationMatrix3D = TransformationMatrix3D.IDENTITY;
	public autoRender : boolean = true;
	
	// Can be used to calculate xf
	protected _scale : number = 16;
	
	// Only used when in 'animation mode' to automaticall update _t and _xf
	protected _animation : ViewAnimationSettings;
	protected _q : Quaternion;
	
	// Keep in mind...
	// May want evntually to offload this all to a webworker or something.
	// In which case we will only need the canvas probably, and just blit RGBA data to it.
	// But that may look so different that it's basically a rewrite from scratch.
	
	protected _canv : HTMLCanvasElement;
	protected _ss  : ShapeSheet;
	protected _ssr : ShapeSheetRenderer;
	protected _ssu : ShapeSheetUtil;
	
	constructor( canvas:HTMLCanvasElement ) {
		this._canv = canvas;
		this._ss   = new ShapeSheet( canvas.width, canvas.height );
		this._ssr  = new ShapeSheetRenderer( this._ss, this._canv, 1 );
		// Since we'll always redraw the entire thing,
		// no need to tell util about the renderer.
		this._ssu  = new ShapeSheetUtil( this._ss );
		
		this.setScaleAndRotation( this._scale, Quaternion.IDENTITY );
	}
	
	public setScaleAndRotation( scale:number, q:Quaternion ) {
		const xforms : TransformationMatrix3D[] = [
			TransformationMatrix3D.translation( new Vector3D(this._ss.width/2, this._ss.height/2) ),
			TransformationMatrix3D.scale( 16 ),
			TransformationMatrix3D.fromQuaternion( q )
		];
		let xf = TransformationMatrix3D.IDENTITY;
		for( let i in xforms ) {
			xf = xf.multiply( xforms[i] );
		}
		this._scale = scale;
		this._q = q;
		this.transform = xf;
	}
	
	protected updateRequested:boolean = false;
	
	/**
	 * Called to indicate that some input has changed
	 * and re-rendering may need to occur (if autoRender = true).
	 */
	protected updated():void {
		if( this.updateRequested ) return;
		this.updateRequested = true;
		
		if( !this.autoRender ) return;
		
		window.requestAnimationFrame( () => {
			this.updateRequested = false;
			this.render();
		});
	}
	
	public set shape( shape:ProceduralShape ) {
		this._shape = shape; this.updated();
	}
	public set t( t:number ) {
		if( this._t == t ) return;
		this._t = t;
		if( this._shape != null && this._shape.isAnimated ) this.updated();
	}
	public set transform( xf:TransformationMatrix3D ) {
		if( this._xf == xf ) return;
		if( this._xf.toString() == xf.toString() ) return;
		this._xf = xf;
		if( this._shape != null ) this.updated();
	}
	public set materials( materials:Array<Material> ) {
		this._ssr.materials = materials;
		if( this._shape != null ) this.updated();
	}
	public set lights( lights:KeyedList<DirectionalLight> ) {
		this._ssr.lights = lights;
		if( this._shape != null ) this.updated();
	}
	
	public get renderer():ShapeSheetRenderer { return this._ssr; }
								 
	public render():void {
		this._ss.initBuffer();
		if( this._shape ) {
			this._shape.draw( this._ssu, this._t, this._xf );
		}
		this._ssr.dataUpdated();
		this._ssr.updateCanvas();
	}
	
	protected updateAnimation( dt:number ) {
		if( dt == 0 ) return;
		
		this.t += dt * this._animation.animationSpeed;
		
		const rots = this._animation.rotationSpeed * dt;
		//const newQ = Quaternion.multiply(this._q, this._animation.rotation);
		const newQ = Quaternion.slerp( this._q, Quaternion.multiply(this._q, this._animation.rotation), rots, false );
		
		this.setScaleAndRotation( this._scale, newQ );
	};
	
	public startAnimation( anim:ViewAnimationSettings ) {
		this._animation = anim;
		this.autoRender = false; // We'll make it happen ourselves!
		let curTime = Date.now();
		const animCallback = () => {
			const prevTime = curTime;
			curTime = Date.now();
			
			let dt = (curTime - prevTime) / 1000;
			if( dt < 0 ) dt = 0; // Don't go backwards because that would be confusing.
			if( dt > 0.1 ) dt = 0.1; // Don't animate too fast
			this.updateAnimation( dt );
			
			if( this.updateRequested ) {
				this.updateRequested = false;
				this.render();
			}
			
			// And then do it again ASAP
			window.requestAnimationFrame(animCallback);
		};
		window.requestAnimationFrame(animCallback);
	}
}

class ShapeViewSet {
	protected _shape : ProceduralShape;
	protected _views : KeyedList<ShapeView> = {};
	protected _materials : Array<Material> = DEFAULT_MATERIAL_MAP;
	protected _lights : KeyedList<DirectionalLight> = DEFAULT_LIGHTS;

	public set shape( shape:ProceduralShape ) {
		this._shape = shape;
		for( let i in this._views ) this._views[i].shape = shape;
	}
	public set materials( materials:Array<Material> ) {
		this._materials = materials;
		for( let i in this._views ) this._views[i].materials = materials;
	}
	public set lights( lights:KeyedList<DirectionalLight> ) {
		this._lights = lights;
		for( let i in this._views ) this._views[i].lights = lights;
	}
	
	/** Returns a read-only list of the views */
	public get views():KeyedList<ShapeView> {
		return freeze(this._views);
	}
	
	public addView( view:ShapeView, name:string ):void {
		view.materials = this._materials;
		view.lights = this._lights;
		this._views[name] = view;
	}
	
	public addViewFromCanvas( canvas:HTMLCanvasElement, name:string ):ShapeView {
		const newView = new ShapeView( canvas );
		this.addView( newView, name );
		return newView;
	}
}

export default class ShapeSheetEditor
{
	protected viewSet:ShapeViewSet = new ShapeViewSet();
	
	public initUi():void { }
	
	public runDemo():void {
		this.viewSet.addViewFromCanvas( <HTMLCanvasElement>document.getElementById('static-view-canvas'), 'static' );
		this.viewSet.addViewFromCanvas( <HTMLCanvasElement>document.getElementById('rotatey-view-canvas'), 'rotatey' );
		
		this.viewSet.shape = {
			isAnimated: true,
			estimateOuterBounds: (t, xf) => new Rectangle( -1, -1, 1, 1 ), // This gets ignored; we just use the whole canvas
			draw: (ssu, t, xf) => {
				let pos:Vector3D = new Vector3D;
				
				ssu.plottedMaterialIndexFunction = (x,y,z) => 1;
				
				xf.multiplyVector( new Vector3D(0,0,0), pos );
				ssu.plotSphere( pos.x, pos.y, pos.z, xf.scale * 0.5 );
				
				xf.multiplyVector( new Vector3D(1,0,0), pos );
				ssu.plotSphere( pos.x, pos.y, pos.z, xf.scale * 0.25 );
			}
		}
		
		const rotatey = this.viewSet.views['rotatey'];
			
		rotatey.setScaleAndRotation( 16, Quaternion.IDENTITY );
		rotatey.startAnimation( {
			animationSpeed: 0.5,
			rotation: Quaternion.fromXYZAxisAngle( 0, 1, 0, Math.PI / 2 ),
			rotationSpeed: 1,
		} );
	}
}
