import { freeze, deepFreeze, thaw } from '../DeepFreezer';
import KeyedList from '../KeyedList';
import ClientRegistry from '../ClientRegistry';
import LightColor from '../LightColor';
import DirectionalLight from '../DirectionalLight';
import SurfaceMaterial from '../SurfaceMaterial';
import ProceduralShape from '../ProceduralShape';
import Rectangle from '../Rectangle';
import Vector3D from '../Vector3D';
import { makeVector, setVector } from '../vector3ds';
import { normalizeVector } from '../vector3dmath';
import Quaternion from '../Quaternion';
import TransformationMatrix3D from '../TransformationMatrix3D';
import ShapeSheet from '../ShapeSheet';
import ShapeSheetRenderer from '../ShapeSheetRenderer';
import ShapeSheetUtil from '../ShapeSheetUtil';
import { DEFAULT_MATERIAL_MAP } from '../surfacematerials';
import { DEFAULT_LIGHTS } from '../lights';
import { Program } from '../forth/rs1'
import { fixScriptText, ForthProceduralShapeCompiler } from '../ForthProceduralShape';
import { utf8Encode, utf8Decode } from 'tshash';
import { getQueryStringValues } from './windowutils';
import Logger from '../Logger';
import MultiLogger from '../MultiLogger';
import DOMLogger from './DOMLogger';

function ensureNotNull<T>( name:string, val:T|null|undefined ):T {
	if( val == null ) throw new Error(name+" is null!");
	return val;
}

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
	public paused : boolean = false;
	
	// Can be used to calculate xf
	protected _scale : number = 16;
	
	// Only used when in 'animation mode' to automaticall update _t and _xf
	protected _animation : ViewAnimationSettings;
	protected _orientation : Quaternion;
	
	// Keep in mind...
	// May want evntually to offload this all to a webworker or something.
	// In which case we will only need the canvas probably, and just blit RGBA data to it.
	// But that may look so different that it's basically a rewrite from scratch.
	
	protected _canv : HTMLCanvasElement;
	protected _ss  : ShapeSheet;
	protected _ssr : ShapeSheetRenderer;
	protected _ssu : ShapeSheetUtil;
	protected _superSampling : number;
	
	constructor( canvas:HTMLCanvasElement, ss:number=1 ) {
		this._canv = canvas;
		this._superSampling = ss;
		this._ss   = new ShapeSheet( canvas.width*ss, canvas.height*ss );
		this._ssr  = new ShapeSheetRenderer( this._ss, this._canv, ss );
		// Since we'll always redraw the entire thing,
		// no need to tell util about the renderer.
		this._ssu  = new ShapeSheetUtil( this._ss );
		
		this.setScaleAndOrientation( this._scale, Quaternion.IDENTITY );
		
		let dragging = false;
		let prevDrag = [0,0];

		const axis = makeVector( 0, 0, 0 );

		// Have to do this to trick the TS compiler
		// into allowing the reference to dragReleasedTick from within its definition.
		let dragReleasedTick = () => {};
		dragReleasedTick = () => {
			let [degX,degY] = prevDrag;

			if( Math.abs(degX) < 1 && Math.abs(degY) < 1 ) return;

			degX *= 0.9; degY *= 0.9;
			setVector(axis, degY, -degX, 0);
			normalizeVector(axis, 1, axis);
			this.rotateBy( Quaternion.fromAxisAngle(axis, Math.sqrt(degX*degX+degY*degY)*Math.PI/180) );
			prevDrag = [degX,degY];

			requestAnimationFrame(dragReleasedTick);
		}

		const dragReleased = () => {
			dragging = false;
			requestAnimationFrame(dragReleasedTick);
		}
		canvas.addEventListener('wheel', (ev) => {
			if( ev.deltaY != 0 ) {
				let amount:number;
				switch( ev.deltaMode ) {
				case 0x00: // DOM_DELTA_PIXEL
					amount = ev.deltaY; break;
				default:
					amount = ev.deltaY < 0 ? -100 : +100;
					break;
				}
				
				this.scale *= Math.pow(2, -amount/100);
			}
			ev.preventDefault();
		}, true);
		canvas.addEventListener('mousedown', (ev) => {
			dragging = true;
		});
		canvas.addEventListener('mouseup', (ev) => {
			dragReleased();
		});
		canvas.addEventListener('mouseleave', (ev) => {
			dragReleased();
		});
		canvas.addEventListener('mousemove', (ev) => {
			if( dragging && (ev.buttons & 1) ) {
				const degX = ev.movementX * 90 / canvas.width;
				const degY = ev.movementY * 90 / canvas.height;
				setVector(axis, degY, -degX, 0);
				normalizeVector(axis, 1, axis);
				this.rotateBy( Quaternion.fromAxisAngle(axis, Math.sqrt(degX*degX+degY*degY)*Math.PI/180) );
				prevDrag = [degX,degY];
			}
		});
	}
	
	public get scale():number { return this._scale; }
	public set scale(s:number) {
		this.setScaleAndOrientation(s, this._orientation);
	}
	
	public set orientation( orientation:Quaternion ) {
		this.setScaleAndOrientation( this._scale, orientation );
	}
	
	public rotateBy( q:Quaternion, amount:number=1 ):void {
		// Erm why can't we just multiply by q, again?  Maybe we can when amount = 1.
		this.orientation = Quaternion.slerp( this._orientation, Quaternion.multiply(q, this._orientation), amount, false );
	}
	
	public setScaleAndOrientation( scale:number, q:Quaternion ) {
		const xforms : TransformationMatrix3D[] = [
			TransformationMatrix3D.translation( makeVector(this._ss.width/2, this._ss.height/2) ),
			TransformationMatrix3D.scale( scale * this._superSampling ),
			TransformationMatrix3D.fromQuaternion( q )
		];
		let xf = TransformationMatrix3D.IDENTITY;
		for( let i in xforms ) {
			xf = xf.multiply( xforms[i] );
		}
		this._scale = scale;
		this._orientation = q;
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
		t -= Math.floor(t);
		if( this._t == t ) return;
		this._t = t;
		if( this._shape != null && this._shape.animationCurveName != "none" ) this.updated();
	}
	public set transform( xf:TransformationMatrix3D ) {
		if( this._xf == xf ) return;
		if( this._xf.toString() == xf.toString() ) return;
		this._xf = deepFreeze(xf);
		if( this._shape != null ) this.updated();
	}
	public set materials( materials:Array<SurfaceMaterial> ) {
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
			this._shape.draw( this._ssu, {
				t: this._t,
				entityState: {},
			}, this._xf );
		}
		this._ssr.dataUpdated();
		this._ssr.updateCanvas();
	}
	
	protected updateAnimation( dt:number ) {
		if( dt == 0 ) return;
		
		this.t = this._t + dt * this._animation.animationSpeed;
		
		this.rotateBy( this._animation.rotation, this._animation.rotationSpeed * dt );
	};
	
	public startAnimation( anim:ViewAnimationSettings ) {
		this._animation = anim;
		this.autoRender = false; // We'll make it happen ourselves!
		let curTime = Date.now();
		
		let animCallback = () => {}; // To reassure the TS compiler
		animCallback = () => {
			const prevTime = curTime;
			curTime = Date.now();
			
			let dt = (curTime - prevTime) / 1000;
			if( !this.paused ) {
				if( dt < 0 ) dt = 0; // Don't go backwards because that would be confusing.
				if( dt > 0.1 ) dt = 0.1; // Don't animate too fast
				this.updateAnimation( dt );
			}
			
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
	protected _materials : Array<SurfaceMaterial> = DEFAULT_MATERIAL_MAP;
	protected _lights : KeyedList<DirectionalLight> = DEFAULT_LIGHTS;
	protected _paused : boolean = false;

	public set paused( p:boolean ) {
		this._paused = p;
		for( let i in this._views ) this._views[i].paused = p;
	}
	public set shape( shape:ProceduralShape ) {
		this._shape = shape;
		for( let i in this._views ) this._views[i].shape = shape;
	}
	public set materials( materials:Array<SurfaceMaterial> ) {
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
	
	public addViewFromCanvas( canvas:HTMLCanvasElement, name:string, ss:number=1 ):ShapeView {
		const newView = new ShapeView( canvas, ss );
		this.addView( newView, name );
		return newView;
	}
}

export default class ProceduralShapeEditor
{
	protected registry:ClientRegistry;
	
	protected scriptBox:HTMLTextAreaElement;
	protected scriptRefBox:HTMLInputElement;
	protected messageBox:HTMLElement;
	protected compileButton:HTMLButtonElement;
	protected saveButton:HTMLButtonElement; 
	protected loadButton:HTMLButtonElement;
	protected logger:Logger = window.console;
	
	protected viewSet:ShapeViewSet = new ShapeViewSet();

	protected program:Program;
	protected compiler:ForthProceduralShapeCompiler;
	
	protected playButton:HTMLElement;
	protected pauseButton:HTMLElement;

	constructor( reg:ClientRegistry ) {
		this.registry = reg;
		this.compiler = new ForthProceduralShapeCompiler();
	}
	
	protected printMessage( text:string, className:string ) {
		let elem = document.createElement('p');
		elem.className = className;
		elem.appendChild( document.createTextNode(text) );
		this.messageBox.appendChild(elem);
		this.messageBox.scrollTop = this.messageBox.scrollHeight;
	}

	protected get scriptText():string { return this.scriptBox.value; }
	protected set scriptText(t:string) { this.scriptBox.value = t; }
	
	public compileProgram():void {
		this.logger.log("Compiling program...");
		this.compiler.compileToShape( this.scriptText ).then( (shape) => {
			this.viewSet.shape = shape;
			this.logger.log("Compiled successfully.");
		}).catch( (err) => {
			this.logger.error('Failed to compile!', err);
		});
	}
	
	protected fixScriptText():string {
		return this.scriptText = fixScriptText(this.scriptText);
	}
	
	protected _oldScriptUrn:string|null = null;
	
	/** Called after the script URN has been changed by a load or save */
	protected scriptUrnUpdated( newUrn:string, pushState:boolean=true ):void {
		if( newUrn === this._oldScriptUrn ) return;
		this.scriptRefBox.value = newUrn;
		if( pushState && window.history && window.history.pushState ) {
			window.history.pushState( { scriptUri: newUrn }, "", "?script-uri="+newUrn );
		}
		this._oldScriptUrn = newUrn;
	}
	
	protected hardSave():void {
		const scriptTextBytes:Uint8Array = utf8Encode(this.fixScriptText());
		let urn = "Holy crap that got saved too fast!";
		urn = this.registry.datastore.fastStore(scriptTextBytes, (success,errorInfo) => {
			if( success ) {
				this.logger.log("Saved "+urn);
			} else {
				this.logger.error("Failed to save "+urn, errorInfo);
			}
		});
		this.logger.log("Saving as "+urn+"...")
		this.scriptUrnUpdated(urn);
	}

	protected loadScript(urn:string, pushState:boolean=true):Promise<string> {
		this.logger.log("Loading from "+urn+"...");
		this.scriptBox.value = "# Loading from "+urn+"...";
		this.scriptBox.disabled = true;
		this.scriptRefBox.value = "";
		const loadProm = this.registry.datastore.fetch(urn).then( (scriptTextBytes) => {
			this.scriptText = utf8Decode(scriptTextBytes);
			this.logger.log("Loaded "+urn);
			this.scriptUrnUpdated(urn, pushState);
			return this.scriptText;
		});
		loadProm.then( () => {
			// We always want to recompile after loading, right?
			this.compileProgram();
		});
		loadProm.catch( (error) => {
			this.logger.error("Failed to load "+urn, error);
			this.scriptText = "# Failed to load "+urn;
		}).then( () => {
			this.scriptBox.disabled = false;
			this.saveButton.disabled = false;
			this.compileButton.disabled = false;
		})
		return loadProm;
	}

	protected scriptTextUpdated():void {
		this.scriptRefBox.value = '';
	}

	public initUi():void {
		this.scriptBox = <HTMLTextAreaElement>document.getElementById('script-text');
		this.messageBox = <HTMLElement>document.getElementById('messages');
		this.scriptRefBox = <HTMLInputElement>document.getElementById('script-ref-box');
		this.compileButton = <HTMLButtonElement>document.getElementById('compile-button');
		this.saveButton = <HTMLButtonElement>document.getElementById('save-button');
		this.loadButton = <HTMLButtonElement>document.getElementById('load-button');
		
		this.logger = new MultiLogger( [
			window.console,
			new DOMLogger(this.messageBox),
		] );
		
		this.scriptBox.addEventListener('change', () => {
			this.scriptTextUpdated();
		});
		this.compileButton.addEventListener('click', () => {
			this.compileProgram();
		});
		this.saveButton.addEventListener('click', () => {
			this.hardSave();
		});
		this.loadButton.addEventListener('click', () => {
			const uri = prompt("Script URI (urn:sha1:... or http://....)", "");
			if( uri === null || uri == "" ) return;
			
			this.loadScript(uri);
		});
		
		this.pauseButton = ensureNotNull('#pause-button', document.getElementById('pause-button'));
		this.playButton = ensureNotNull('#play-button', document.getElementById('play-button'));
		
		this.pauseButton.addEventListener('click', () => {
			this.pauseAnimation();
		});
		this.playButton.addEventListener('click', () => {
			this.resumeAnimation();
		});
		
		this.resumeAnimation();
		
		window.addEventListener('popstate', (evt) => {
			if( evt.state.scriptUri ) {
				this.loadScript(evt.state.scriptUri, false);
			}
		});
	}
	
	protected pauseAnimation():void {
		this.viewSet.paused = true;
		this.pauseButton.style.display = 'none';
		this.playButton.style.display = '';
	}
	protected resumeAnimation():void {
		this.viewSet.paused = false;
		this.playButton.style.display = 'none';
		this.pauseButton.style.display = '';
	}
	
	public get lights():KeyedList<DirectionalLight> { return this.viewSet.lights; }
	public set lights(l:KeyedList<DirectionalLight>) { this.viewSet.lights = l; }
	
	public resetLights() {
		this.lights = DEFAULT_LIGHTS;
	}
	
	public randomizeLights() {
		var lights:KeyedList<DirectionalLight> = {};
		lights["primary"] = new DirectionalLight(
			makeVector(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5),
			new LightColor(Math.random()*1.5, Math.random()*1.5, Math.random()*1.5), {
				shadowFuzz: 0.1,
				shadowDistance: 32,
				minimumShadowLight: 0.05
			}
		);
		lights["glow"] = new DirectionalLight(
			makeVector(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5),
			new LightColor(Math.random(), Math.random(), Math.random()), {
				shadowFuzz: 0.1,
				shadowDistance: 32,
				minimumShadowLight: 0.1
			}
		);
		this.lights = lights;
	}
	
	protected addViewFromCanvasByName( name:string, ss:number=1, init?:(v:ShapeView)=>void ):void {
		const elemName:string = name+'-view-canvas';
		let elem:HTMLCanvasElement|null = <HTMLCanvasElement>document.getElementById(elemName)
		if( elem == null ) {
			console.warn("No such canvas: "+elemName);
			return;
		}
		const sv = this.viewSet.addViewFromCanvas(elem, name, ss);
		if( init ) init(sv);
	}
	
	public runDemo():void {
		this.addViewFromCanvasByName('static', 2)
		this.addViewFromCanvasByName('static2', 2, (static2) => {
			static2.setScaleAndOrientation( 32, Quaternion.IDENTITY );
		});
		this.addViewFromCanvasByName('rotatey', 1, (rotatey) => {
			rotatey.startAnimation( {
				animationSpeed: 1,
				rotation: Quaternion.fromXYZAxisAngle( 0, 1, 0, Math.PI / 2 ),
				rotationSpeed: 1,
			} );
		});
		
		const qsParams = getQueryStringValues();
		if( qsParams["script-uri"] ) {
			this.loadScript(qsParams["script-uri"]);
		} else {
			// Just load the default one...
			this.compileProgram();
		}
	}
}
