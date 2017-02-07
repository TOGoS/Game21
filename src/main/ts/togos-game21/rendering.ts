/// <reference path="../Map.d.ts"/>

import KeyedList from './KeyedList';
import Rectangle from './Rectangle';
import DirectionalLight from './DirectionalLight';
import { scaleAabb } from './aabbs';
import Vector3D from './Vector3D';
import { ZERO_VECTOR } from './vector3ds';
import { scaleVector } from './vector3dmath';
import Quaternion from './Quaternion';
import TransformationMatrix3D from './TransformationMatrix3D';
import ImageSlice from './ImageSlice';
import { MaterialPalette } from './surfacematerials';
import GameDataManager from './GameDataManager';
import { isResolved, resolvedPromise, value, resolveWrap, shortcutThen, voidify, RESOLVED_VOID_PROMISE } from './promises';
import { asciiDecode, utf8Decode } from 'tshash/utils';
import { imagePromiseFromUrl, EMPTY_IMAGE_SLICE } from './images';
import { AnimationCurveName } from './AnimationCurve';

import DrawCommandBuffer from './DrawCommandBuffer';

import { Entity, StructureType, EntityClass, EMPTY_STATE } from './world';
import { eachSubEntity } from './worldutil';

// TODO:
// When done, this should obsolete CanvasWorldView and ObjectImageManager.
// So delete those.

import DynamicEntityVisual, {
	EntityVisualPropertiesContext,
	fixEntityVisualProperties
} from './DynamicEntityVisual';
import CompoundVisual from './CompoundVisual';
import BitImageVisual from './BitImageVisual';
import { isBitImageVisualRef, parseBitImageVisualRefRegexResult, bitImageVisualToRgbaData } from './bitimages';
import ForthProceduralShape, { ForthProceduralShapeCompiler } from './ForthProceduralShape';

import ShapeSheetUtil from './ShapeSheetUtil';
import ShapeSheetRenderer from './ShapeSheetRenderer';

import { ProgramExpression, evaluateExpression, standardFunctions } from './internalsystemprogram';

type Visual = BitImageVisual|CompoundVisual|DynamicEntityVisual|ForthProceduralShape;

/** A hard (urn:sha1:...) or soft (urn:uuid:...) ref to a visual */
type VisualRef = string;
/** Reference to a visual that's already been resolved to its final form */
type HardVisualRef = string;

interface RenderingContext {
	lights : KeyedList<DirectionalLight>;
	materialRefs : MaterialPalette;
	dictionaryRootRef : string;
}

export function rgbaDataToImageDataUri( rgba:Uint8ClampedArray, width:number, height:number ) {
	const canv = document.createElement('canvas');
	canv.width = width;
	canv.height = height;
	const ctx = canv.getContext('2d');
	if( !ctx ) throw new Error("Failed to get 2d context on temporary canvas to rgbaDataToImageDataUri");
	ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
	return canv.toDataURL();
}

/**
 * Indicates whether drawing is allowed to be deferred.
 * See quankize for usage.
 */
enum Quank {
	NEVER=0,
	ALWAYS=1,
	UNLESS_DEFERRED=2,
}

/** See implementation for description. */
function quankize<T,R>( promise:Thenable<T>, quank:Quank, callback:(v:T, quank:Quank)=>Thenable<R> ):Thenable<R> {
	if( isResolved(promise) ) {
		// No deferral!  quank gets passed to callback un-translated.
		return callback(value(promise), quank);
	} else {
		// It's deferred, so UNLESS_DEFERRED gets translated to NEVER.
		if( quank == Quank.UNLESS_DEFERRED ) quank = Quank.NEVER;
		return promise.then( (v) => callback(v, quank) );
	}
}

/**
 * sc = screen coordinates
 * wc = world coordinates (relative to the screen center)
 *  i = immediate (skips rendering unavailable components)
 *  p = deferred (waits for components, returning a promise)
 */

export class EntityRenderer {
	protected drawCommandBuffer:DrawCommandBuffer = new DrawCommandBuffer();
	public clip:Rectangle;
	
	public constructor(
		public canvas:HTMLCanvasElement,
		protected gameDataManager:GameDataManager,
		protected imageCache:VisualImageManager,
		/** origin in screen pixel coordinates corresponding to 'world' 0,0,x */
		public screenOriginX:number, public screenOriginY:number,
		/** Scale at minimum parallax depth */
		public unitPpm:number,
		/**
		 * Anything at this depth or closer will be drawn at scale of unitPpm.
		 * Scale beyond = unitPpm / (1 + z - maxParallaxDepth),
		 * so e.g. 1/2 @ maxParallaxDepth+1, 1/3 @ maxParallaxDepth+2, etc.
		 * Set to 1 for 'realistic' rendering (for things at or beyond z=1, at least).
		 */
		public minParallaxDepth:number
	) {
		this.clip = new Rectangle(0, 0, canvas.width, canvas.height);
	}
	
	protected scaleAtDepth( z:number ):number {
		const mpd = this.minParallaxDepth;
		return this.unitPpm / 1 + Math.max(0, z - mpd);
	}
	
	protected sciAddImageSlice( x:number, y:number, z:number, orientation:Quaternion, scale:number, imageSlice:ImageSlice<HTMLImageElement> ):void {
		const imageScale = scale / imageSlice.resolution;
		const bounds = imageSlice.bounds;
		const origin = imageSlice.origin
		const width = bounds.maxX-bounds.minX, height = bounds.maxY-bounds.minY;
		// TODO: Use orientation and stuff
		this.drawCommandBuffer.addImageDrawCommand(
			imageSlice.sheet,
			bounds.minX, bounds.minY, width, height,
			x + imageScale*(bounds.minX-origin.x), y + imageScale*(bounds.minY-origin.y),
			imageScale*width, imageScale*height,
			z + imageScale*bounds.minZ
		);
	}
	
	protected wciAddImageSlice( pos:Vector3D, orientation:Quaternion, imageSlice:ImageSlice<HTMLImageElement> ):void {
		// Warning: world-screen position code is duplicated!
		const scx = this.screenOriginX, scy = this.screenOriginY;
		const scale = this.scaleAtDepth(pos.z + imageSlice.bounds.minZ/this.unitPpm);
		const sx = scx + pos.x*scale;
		const sy = scy + pos.y*scale;
		this.sciAddImageSlice(sx, sy, pos.z, orientation, scale, imageSlice);
	}
	
	// Caches to shortcut rendering for static, stateless visuals
	// TODO: Right now these assume image being drawn at unitPpm;
	// no other resolution is stored.
	protected simpleEntityVisualRefImageSliceCache =
		new Map<string,ImageSlice<HTMLImageElement>>();
	protected simpleEntityClassRefImageSliceCache =
		new Map<string,undefined|ImageSlice<HTMLImageElement>>();
	
	public wcdAddEntityVisualRef( pos:Vector3D, orientation:Quaternion, visualRef:string, entityState:KeyedList<any>, animationTime:number, quank:Quank=Quank.ALWAYS ):Thenable<void> {
		// guess!  (there may be a better way to determine what resolution to ask for)
		const rezo = 1 << Math.ceil( Math.log(this.scaleAtDepth(pos.z))/Math.log(2) );
		
		return quankize(this.imageCache.fetchVisual(visualRef), quank, (visual:Visual, quank:Quank) => {
			/*
			if( visual.classRef == "http://ns.nuke24.net/Game21/CompoundVisual" ) {
				// Ignore transform for now....
				let prams:Thenable<void>[]|null = null;
				for( let c in visual.components ) {
					const comp = visual.components[c];
					const prem = this.wcdAddEntityVisualRef(pos, orientation, comp.visualRef, entityState, animationTime, quank );
					if( !isResolved(prem) ) {
						if( prams == null ) prams = [];
						prams.push(prem);
					}
				}
				return prams == null ? RESOLVED_VOID_PROMISE : voidify(Promise.all(prams));
			}
			*/
			
			return quankize(this.imageCache.fetchVisualImageSlice(visualRef, entityState, animationTime, orientation, rezo ), quank, (imageSlice:ImageSlice<HTMLImageElement>, quank:Quank) => {
				this.imageCache.fetchVisualMetadata(visualRef).then( (visualMetadata) => {
					// TODO: probably should pay some attention to resolution, here
					if( !visualMetadata.variesBasedOnState && visualMetadata.animationLength == 0 ) {
						this.simpleEntityVisualRefImageSliceCache.set(visualRef, imageSlice);
					}
				});
				
				if( quank == Quank.NEVER ) return RESOLVED_VOID_PROMISE;
				this.wciAddImageSlice(pos, orientation, imageSlice);
				return RESOLVED_VOID_PROMISE;
			});
		});
	}
	
	public wciAddEntityVisualRef( pos:Vector3D, orientation:Quaternion, visualRef:string, entityState:any, animationTime:number ):Thenable<void> {
		const imgSlice = this.simpleEntityVisualRefImageSliceCache.get(visualRef);
		if( imgSlice ) {
			this.wciAddImageSlice(pos, orientation, imgSlice);
			return RESOLVED_VOID_PROMISE;
		}
		
		// May need to replace with a more specialized implement
		return this.wcdAddEntityVisualRef(pos, orientation, visualRef, entityState, animationTime, Quank.UNLESS_DEFERRED);
	}
	
	public wcdAddEntity( pos:Vector3D, orientation:Quaternion, entity:Entity, time:number, quank:Quank=Quank.ALWAYS ):Thenable<void> {
		return quankize(this.gameDataManager.fetchObject<EntityClass>( entity.classRef ), quank, (entityClass, quank):Thenable<void> => {
			const vbb = entityClass.visualBoundingBox;
			
			const backZ = vbb.maxZ + pos.z;
			if( backZ <= 0 ) return RESOLVED_VOID_PROMISE;
			
			const backScale = this.scaleAtDepth(backZ);
			
			const scx = this.screenOriginX, scy = this.screenOriginY;
			
			if(
				scx + backScale * (vbb.maxX + pos.x) <= this.clip.minX ||
				scx + backScale * (vbb.minX + pos.x) >= this.clip.maxX ||
				scy + backScale * (vbb.maxY + pos.y) <= this.clip.minY ||
				scy + backScale * (vbb.minY + pos.y) >= this.clip.maxY
			) return RESOLVED_VOID_PROMISE;
			
			const animationTime = time - (entity.animationStartTime||0);
			if( animationTime == null || isNaN(animationTime) ) {
				console.error("animationTime is bad!", time, "Entity animationStartTime:", entity.animationStartTime);
			}
			
			const drawPromises:Thenable<void>[] = [];
			if( entityClass.visualRef ) {
				drawPromises.push(this.wcdAddEntityVisualRef(
					pos, orientation, entityClass.visualRef, entity.state||EMPTY_STATE,
					animationTime,
					quank
				));
			}
			if( !this.simpleEntityClassRefImageSliceCache.has(entity.classRef) ) {
				this.simpleEntityClassRefImageSliceCache.set(entity.classRef, undefined);
				
				if( entityClass.structureType == StructureType.INDIVIDUAL && entityClass.visualRef ) {
					const visualRef = entityClass.visualRef;
					this.imageCache.fetchVisualMetadata(visualRef).then( (visualMetadata) => {
						if( !visualMetadata.variesBasedOnState && visualMetadata.animationLength == 0 ) {
							// Goes in the simple cache!
							this.imageCache.fetchVisualImageSlice(visualRef, EMPTY_STATE, 0, Quaternion.IDENTITY, this.unitPpm).then( (imageSlice) => {
								this.simpleEntityClassRefImageSliceCache.set(entity.classRef, imageSlice);
							});
						}
					});
				}
			}
			eachSubEntity( pos, orientation, entity, this.gameDataManager, (subPos, subOri, subEnt) => {
				drawPromises.push(this.wcdAddEntity(subPos, subOri, subEnt, time));
			}, this );
			
			return voidify(Promise.all(drawPromises));
		});
	}
	
	public wciAddEntity( pos:Vector3D, orientation:Quaternion, entity:Entity, time:number ):Thenable<void> {
		const imgSlice = this.simpleEntityClassRefImageSliceCache.get(entity.classRef);
		if( imgSlice ) {
			this.wciAddImageSlice(pos, orientation, imgSlice);
			return RESOLVED_VOID_PROMISE;
		}
		
		// May need to replace with a more specialized implement
		return this.wcdAddEntity(pos, orientation, entity, time, Quank.UNLESS_DEFERRED);
	}
	
	protected get renderingContext2d():CanvasRenderingContext2D|null {
		return this.canvas.getContext('2d');
	}
	
	public flush() {
		const ctx = this.renderingContext2d;
		if( !ctx ) return;
		ctx.mozImageSmoothingEnabled = false;
		ctx.webkitImageSmoothingEnabled = false;
		ctx.msImageSmoothingEnabled = false;
		ctx.oImageSmoothingEnabled = false;
		(<any>ctx).imageSmoothingEnabled = false;
		this.drawCommandBuffer.flushDrawCommands(ctx);
	}
}

export class WorldRenderer extends EntityRenderer {
	// TODO: Copy stuff from CanvasWorldView
}

function fixImageSliceImage( slice:ImageSlice<HTMLImageElement|undefined> ):Thenable<ImageSlice<HTMLImageElement>> {
	if( slice.sheet == null ) return shortcutThen( imagePromiseFromUrl(slice.sheetRef), (img) => {
		slice.sheet = img;
		return slice;
	});
	return resolvedPromise(slice);
}

const RESO_K_OFFSET = 32;

type ImageParamsKey = string;

function imageParamsKey( visualRef:VisualRef, state:KeyedList<any>, intervalId:string, orientation:Quaternion, resolution:number ):ImageParamsKey {
	if( state == null ) state = EMPTY_STATE;
	return JSON.stringify({
		visualRef, state, intervalId, orientation, resolution
	});
}

interface VisualMetadata {
	/** Hash-based URN of the visual object */
	hardVisualRef : string;
	/** Whether state affects this visual at all */
	variesBasedOnState : boolean;
	/**
	 * Total animation length, taking into account that frames may themselves be visuals
	 * Should be zero for non-animated things.
	 */
	animationLength : number;
	animationCurveName : AnimationCurveName;
	
	discreteAnimationStepCount : number;
}

const EMPTY_IMAGE_SLICE_PROMISE = resolvedPromise(EMPTY_IMAGE_SLICE);

const objectRefRegex = /^urn:.*#$/;
const dataRefRegex = /^urn:[^#]*$/;

function canvasToRgbaSlice(canv:HTMLCanvasElement, origin:Vector3D, resolution:number ):ImageSlice<Uint8ClampedArray> {
	const ctx = canv.getContext('2d');
	if( ctx == null ) throw new Error("No 2d context!");
	const sheet = ctx.getImageData(0,0,canv.width,canv.height).data;
	return new ImageSlice<Uint8ClampedArray>(
		sheet,
		origin,
		resolution,
		{
			minX: 0, minY: 0,
			minZ: 0, // ack, not right!
			maxX: canv.width, maxY: canv.height,
			maxZ: 0, // ack, not right!
		}
	);
}

interface TInterval {
	t0: number;
	t1: number;
	intervalId: string;
}

/**
 * Some terms:
 * 'animation time' = world time since an animation began
 * 'animation phase' a.k.a. 't' is a number, 0-1, indicating a point in an animation
 * animation phase = animation time / animation length
 */
export class VisualImageManager {
	/**
	 * This should be an integer factor
	 * Of the number of frames per second you want to draw at.
	 */
	protected animationResolution:number;

	/**
	 * May use RenderingContext.dictionaryRootRef
	 * as part of a cache key,
	 * but will rely on gameDataManager to actually do lookups
	 */
	public constructor( protected renderingContext:RenderingContext, protected gameDataManager:GameDataManager, opts:{
		animationResolution?:number
	}={} ) {
		this.animationResolution = opts.animationResolution || 16;
	}
	
	protected visualMetadataCache = new Map<VisualRef,Thenable<VisualMetadata>>();
	
	protected resolveToHardVisualRef( ref:string ):Promise<string> {
		if( ref.match(/^urn:uuid:/) ) {
			return this.gameDataManager.fetchHardRef(ref);
		} else {
			return Promise.resolve(ref);
		}
	}
	
	protected visualCache = new Map<VisualRef, Thenable<Visual>>();
	
	protected _fetchVisual( visualRef:HardVisualRef ):Thenable<Visual> {
		let prom = this.visualCache.get(visualRef);
		if( prom ) return prom;
		
		prom = resolveWrap(new Promise<Visual>( (resolve,reject) => {
			const bitImgRer = isBitImageVisualRef(visualRef);
			if( bitImgRer ) return resolve(parseBitImageVisualRefRegexResult(bitImgRer));
			
			if( objectRefRegex.exec(visualRef) ) {
				return resolve(this.gameDataManager.fetchObject<Visual>(visualRef));
			}
			
			if( dataRefRegex.exec(visualRef) ) {
				return resolve(this.gameDataManager.fetchObject<Uint8Array>(visualRef).then( (data) => {
					if( !data.slice ) {
						return Promise.reject(visualRef+" didn't resolve to a byte array");
					}
					
					const g21FpsMagic = "#G21-FPS-1.0";
					if( asciiDecode(data.slice(0,g21FpsMagic.length)) == g21FpsMagic ) {
						// TODO: should probably do all this rendering
						// in like a webworker or something
						const fpsc = new ForthProceduralShapeCompiler();
						return fpsc.compileToShape(utf8Decode(data), {filename: visualRef, lineNumber:1, columnNumber:1});
					}
					return Promise.reject(
						"Hey I don't know how to interpret this image data ("+
						data.length+" bytes) as a visual");
				}));
			}
			
			// TODO: Fetch the data, look at magic to see if it's a #G21-FPS-1.0
			
			return reject(new Error("Unsupported visual ref "+visualRef));
		}));
		
		this.visualCache.set(visualRef, prom);
		return prom;
	}
	
	public fetchVisual( visualRef:VisualRef ):Thenable<Visual> {
		return this.resolveToHardVisualRef(visualRef).then( (hardVisualRef) => this._fetchVisual(hardVisualRef) );
	}
	
	public fetchVisualMetadata( visualRef:string ):Thenable<VisualMetadata> {
		let md = this.visualMetadataCache.get(visualRef);
		if( md ) return md;
		
		md = resolveWrap(this.resolveToHardVisualRef(visualRef).then( (hardVisualRef) => {
			return this.fetchVisual(hardVisualRef).then( (visual:Visual):Promise<VisualMetadata> => {
				switch( visual.classRef ) {
				case "http://ns.nuke24.net/Game21/BitImageVisual":
					return resolvedPromise({
						hardVisualRef,
						variesBasedOnState: false,
						animationLength: 0,
						animationCurveName: "none",
						discreteAnimationStepCount: 1,
					});
				case "http://ns.nuke24.net/Game21/DynamicEntityVisual":
					{
						// TODO: analyze the expression to see if it uses state.
						const variesBasedOnState = true;
						
						return resolvedPromise({
							hardVisualRef,
							variesBasedOnState,
							animationLength: visual.animationLength || 0,
							animationCurveName: visual.animationCurveName,
							discreteAnimationStepCount: visual.discreteAnimationStepCount,
						});
					}
				case "http://ns.nuke24.net/Game21/ScriptProceduralShape":
					{
						// TODO: analyze program or look at headers
						const variesBasedOnState = true;
						
						return resolvedPromise({
							hardVisualRef,
							variesBasedOnState,
							animationLength: visual.animationLength,
							animationCurveName: visual.animationCurveName,
							discreteAnimationStepCount: visual.discreteAnimationStepCount,
						});
					}
				default:
					return Promise.reject("Lolz not implemented to extract metadata from a "+visual.classRef);
				}
			});
		}));
		
		this.visualMetadataCache.set(visualRef, md);
		return md;
	}
	
	/**
	 * For entities that always look the same regardless of state or time
	 * RESO_K_OFFSET+log2(resolution:int) => visual ref => Thenable<ImageSlice<HTMLImageElement>>
	 */
	protected staticVisualImageCache: Map<VisualRef,Thenable<ImageSlice<HTMLImageElement|undefined>>>[] = [];
	
	/**
	 * Cache for images with more inputs.
	 */
	protected paramsKeyedVisualImageCache = new Map<ImageParamsKey,Thenable<ImageSlice<HTMLImageElement|undefined>>>();
	
	/**
	 * Given a time since animation start,
	 * return the t interval (where ends fall on animation resolution boundaries)
	 */
	protected timeToAnimationInterval( animTime:number, md:VisualMetadata ):TInterval {
		if( md.animationLength == 0 ) return {t0:0,t1:0,intervalId:'0'};
		
		switch( md.animationCurveName ) {
		case 'once':
			if( animTime <= 0 ) return {t0:0,t1:0,intervalId:'begin'};
			if( animTime >= md.animationLength ) return {t0:1,t1:1,intervalId:'end'};
			break;
		default: // well, for loop; TODO: reverse maybe should be different
			animTime -= md.animationLength * Math.floor(animTime / md.animationLength);
		}
		
		// TODO: If animationLength/discreteAnimationStepCount > animationResolution,
		// then use a coarser resolution
		const effectiveResolution = this.animationResolution;
		const stepCount = Math.floor(md.animationLength*effectiveResolution);
		let slotId = Math.floor(animTime * effectiveResolution);
		if( slotId >= stepCount ) slotId = 0;
		
		return {
			t0: slotId     / stepCount,
			t1: (slotId+1) / stepCount,
			intervalId: slotId + '-' + (slotId+1) + '/' + stepCount
		};

	}
	
	// TODO: instead of an instant in time, take a range so we can do motion blurred animations!
	// TODO: CROP!
	protected generateVisualRgbaSlice(
		visualRef:VisualRef, state:KeyedList<any>, t0:number, t1:number, orientation:Quaternion, preferredResolution:number
	):Thenable<ImageSlice<Uint8ClampedArray>> {
		const tAvg = (t0+t1)/2;
		return this.fetchVisual(visualRef).then( (visual:Visual):Thenable<ImageSlice<Uint8ClampedArray>> => {
			switch( visual.classRef ) {
			case "http://ns.nuke24.net/Game21/BitImageVisual":
				const rgbaData = bitImageVisualToRgbaData(visual);
				return Promise.resolve({
					sheet: rgbaData,
					origin: {
						x: visual.originX,
						y: visual.originY,
						z: visual.originZ,
					},
					resolution: visual.resolution,
					bounds: {
						minX: 0,
						maxX: visual.width,
						minY: 0,
						maxY: visual.height,
						minZ: 0,
						maxZ: 0,
					},
				});
			case "http://ns.nuke24.net/Game21/DynamicEntityVisual":
				return this.gameDataManager.fetchObject<ProgramExpression>(visual.propertiesExpressionRef).then( (expr) => {
					const animationLength = visual.animationLength == 0 ? 1 : visual.animationLength;
					const animationTime  = tAvg * animationLength;
					const animationPhase = tAvg;
					return fixEntityVisualProperties(evaluateExpression(expr, {
						functions: standardFunctions,
						variableValues: <EntityVisualPropertiesContext>{
							entityState: state,
							// TODO: Make sure these get set right for infinite animations, etc
							animationFrameCount: visual.discreteAnimationStepCount,
							animationLength: visual.animationLength,
							animationTime,
							animationFrameNumber: Math.floor(animationPhase * visual.discreteAnimationStepCount),
							animationPhase,
						}
					}), visual.propertiesExpressionRef);
				}).then( (props) => {
					// TODO: allow material overrides
					return this.generateVisualRgbaSlice(
						props.visualRef, {}, t0, t1, orientation, preferredResolution
					);
				});
			case "http://ns.nuke24.net/Game21/CompoundVisual":
				{
					const canv = document.createElement('canvas');
					// TODO: Need a better way to come up with vbb
					const vbb = {minX:-0.5, minY:-0.5, minZ:-0.5, maxX:0.5, maxY:0.5, maxZ:0.5};
					const originX = -preferredResolution*vbb.minX;
					const originY = -preferredResolution*vbb.minY;
					const enRen = new EntityRenderer(
						canv, this.gameDataManager, this,
						originX, originY, preferredResolution,
						Infinity
					);					
					const compz = visual.components;
					const promz:Thenable<void>[] = [];
					for( let c=0; c<compz.length; ++c ) {
						const comp = compz[c];
						const xform = comp.transformation;
						const pos = {x:xform.x1, y:xform.y1, z:xform.z1};
						promz.push(enRen.wcdAddEntityVisualRef(pos, Quaternion.IDENTITY, comp.visualRef, state, tAvg));
					}
					return Promise.all(promz).then( () => {
						enRen.flush();
						return canvasToRgbaSlice(canv, {x:originX, y:originY, z:0}, preferredResolution)
					});
				}
			case "http://ns.nuke24.net/Game21/ScriptProceduralShape":
				{
					const superSampling = 2;
					const psParams = { t:tAvg, entityState:state };
					const shapeSheetSlice = ShapeSheetUtil.proceduralShapeToShapeSheet(visual, psParams, orientation, preferredResolution*superSampling, superSampling);
					const shapeSheetRenderer = new ShapeSheetRenderer(shapeSheetSlice.sheet, undefined, 2);
					//shapeSheetRenderer.dataUpdated();
					shapeSheetRenderer.updateCellColors();
					console.group("Generating RGBA slice for ScriptProceduralShape "+visualRef+"...");
					try {
						const imgData = shapeSheetRenderer.toUint8Rgba();
						const imgSlice = new ImageSlice<Uint8ClampedArray>(
							imgData,
							scaleVector(shapeSheetSlice.origin, 1/superSampling),
							preferredResolution, 
							scaleAabb(shapeSheetSlice.bounds, 1/superSampling)
						);
						return resolvedPromise(imgSlice);
					} finally {
						console.groupEnd();
					}
				}
			default:
				return Promise.reject(new Error("Don't yet know how to generateVisualRgbaSlice "+visual!.classRef));
			}
		});
	}
	
	public fetchRefOnlyVisualImageSlice( visualRef:VisualRef, state:KeyedList<any>, time:number, orientation:Quaternion, preferredPpm:number ):Thenable<ImageSlice<HTMLImageElement|undefined>> {
		const resoLog = Math.round(Math.log(preferredPpm)/Math.log(2));
		const resolution = 1 << resoLog;
		const resoKey = RESO_K_OFFSET + resoLog;
		
		if( orientation === Quaternion.IDENTITY ) {
			const c1 = this.staticVisualImageCache[resoKey];
			if( c1 != null ) {
				const c2 = c1.get(visualRef);
				if( c2 != null ) return c2;
			}
		}
		
		const mdp = this.fetchVisualMetadata(visualRef);
		
		return shortcutThen(mdp, (md) => {
			let tInterval = this.timeToAnimationInterval( time, md );
			const paramsKey = imageParamsKey(
				md.hardVisualRef, (md.variesBasedOnState ? state||EMPTY_STATE : EMPTY_STATE),
				tInterval.intervalId, orientation, resolution); 
				
			let sliceProm:Thenable<ImageSlice<HTMLImageElement|undefined>>|undefined = this.paramsKeyedVisualImageCache.get(paramsKey);
			if( sliceProm ) return sliceProm;
			
			// console.log("Generating image for params key "+paramsKey+"; Visual metadata:", md);
			
			sliceProm = this.generateVisualRgbaSlice(
				visualRef, state, tInterval.t0, tInterval.t1, orientation, resolution
			).then( (rgbaSlice):Promise<ImageSlice<HTMLImageElement|undefined>> => {
				if( rgbaSlice.bounds.minX != 0 || rgbaSlice.bounds.minY != 0 ) {
					// We're assuming that the rgbaSlice corresponds 1-1 with its rgbaData.
					return Promise.reject(new Error("Ack!"));
				}
				const dataUri = rgbaDataToImageDataUri(rgbaSlice.sheet, rgbaSlice.bounds.maxX, rgbaSlice.bounds.maxY );
				return Promise.resolve(<ImageSlice<HTMLImageElement|undefined>>{
					sheetRef: dataUri,
					sheet: undefined,
					origin: rgbaSlice.origin,
					bounds: rgbaSlice.bounds,
					resolution: rgbaSlice.resolution,
				});
			});
			
			sliceProm.catch( (err) => {
				console.error("Error generating image for "+visualRef+":", err);
			});
			
			sliceProm = resolveWrap(sliceProm);
			this.paramsKeyedVisualImageCache.set(paramsKey, sliceProm);
			return sliceProm;
		});
	}
	
	public fetchVisualImageSlice( visualRef:VisualRef, state:KeyedList<any>, time:number, orientation:Quaternion, preferredPpm:number ):Thenable<ImageSlice<HTMLImageElement>> {
		const st = this.fetchRefOnlyVisualImageSlice( visualRef, state, time, orientation, preferredPpm );
		if( isResolved(st) ) {
			const s = value(st);
			return s.sheet ? st : fixImageSliceImage(s);
		} else {
			return st.then( fixImageSliceImage );
		} 
	}
	
	/**
	 * qet means 'Get or enQueue for getting'
	 */
	public qetVisualImageSlice( visualRef:VisualRef, state:KeyedList<any>, time:number, orientation:Quaternion, preferredPpm:number ):ImageSlice<HTMLImageElement>|undefined {
		const prom = this.fetchVisualImageSlice(visualRef, state, time, orientation, preferredPpm );
		return isResolved(prom) ? value(prom) : undefined;
	}
	
	/// Entity renderingContext
	
	public fetchEntityImageSlice( entity:Entity, time:number, orientation:Quaternion, preferredPpm:number ):Thenable<ImageSlice<HTMLImageElement>> {
		// If entity is compound, this should include its sub-parts
		return this.gameDataManager.fetchObject<EntityClass>(entity.classRef).then( (entityClass:EntityClass):Thenable<ImageSlice<HTMLImageElement>> => {
			switch( entityClass.structureType ) {
			case StructureType.INDIVIDUAL:
				if( entityClass.visualRef ) {
					return this.fetchVisualImageSlice(entityClass.visualRef, entity.state||EMPTY_STATE, time, orientation, preferredPpm);
				} else {
					return EMPTY_IMAGE_SLICE_PROMISE;
				}
			case StructureType.NONE:
				return EMPTY_IMAGE_SLICE_PROMISE;
			case StructureType.LIST:
			case StructureType.STACK:
			case StructureType.TILE_TREE:
				// Ignore any visualRef for now because I don't think compound entities will have them anyway.
				// And if they do, what does that mean?  Draw in addition to or instead of sub-entities?
				
				const canv = document.createElement('canvas');
				const vbb = entityClass.visualBoundingBox;
				canv.width  = preferredPpm * (vbb.maxX-vbb.minX);
				canv.height = preferredPpm * (vbb.maxY-vbb.minY);
				const originX = -preferredPpm*vbb.minX;
				const originY = -preferredPpm*vbb.minY;
				const enRen = new EntityRenderer(
					canv, this.gameDataManager, this,
					originX, originY, preferredPpm,
					Infinity
				);
				return enRen.wcdAddEntity( ZERO_VECTOR, orientation, entity, time ).then( () => {
					enRen.flush();
					const sheetRef = canv.toDataURL();
					// MAYBEDO: Could crop it, I guess!
					return imagePromiseFromUrl(sheetRef).then( (sheet:HTMLImageElement):ImageSlice<HTMLImageElement> => {
						const slice = new ImageSlice(
							sheet,
							{x:originX, y:originY, z:0},
							preferredPpm,
							{
								minX: 0, minY: 0,
								minZ: 0, // ack, not right!
								maxX: canv.width, maxY: canv.height,
								maxZ: 0, // ack, not right!
							}
						);
						slice.sheetRef = sheetRef;
						return slice;
					});
				});
			}
		});
	}
}
