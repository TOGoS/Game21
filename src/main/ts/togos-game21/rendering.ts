/// <reference path="../Map.d.ts"/>

import KeyedList from './KeyedList';
import Rectangle from './Rectangle';
import DirectionalLight from './DirectionalLight';
import Vector3D from './Vector3D';
import { ZERO_VECTOR } from './vector3ds';
import Quaternion from './Quaternion';
import ImageSlice from './ImageSlice';
import { MaterialPalette } from './surfacematerials';
import GameDataManager from './GameDataManager';
import { isResolved, resolvedPromise, value, resolveWrap, shortcutThen, voidify } from './promises';
import { imagePromiseFromUrl, EMPTY_IMAGE_SLICE } from './images';

import DrawCommandBuffer from './DrawCommandBuffer';

import { Entity, StructureType, EntityClass } from './world';
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

import { ProgramExpression, evaluateExpression, standardFunctions } from './internalsystemprogram';

type Visual = BitImageVisual|CompoundVisual|DynamicEntityVisual;

type VisualRef = string;

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
 * sc = screen coordinates
 * wc = world coordinates (relative to the screen center)
 *  i = immediate
 *  p = deferred (returning a promise)
 */

export class EntityRenderer {
	protected drawCommandBuffer:DrawCommandBuffer = new DrawCommandBuffer();
	public clip:Rectangle;
	public time:number;
	
	public constructor(
		public canvas:HTMLCanvasElement,
		protected gameDataManager:GameDataManager,
		protected imageCache:VisualImageManager,
		public screenCenterX:number,
		public screenCenterY:number,
		public unitPpm:number, // Scale at minimum parallax depth
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
	
	public wcdAddEntity( pos:Vector3D, orientation:Quaternion, entity:Entity ):Promise<void> {
		return this.gameDataManager.fetchObject<EntityClass>( entity.classRef ).then( (entityClass) => {
			const vbb = entityClass.visualBoundingBox;
			
			const backZ = vbb.maxZ + pos.z;
			if( backZ <= 0 ) return;
			const backScale = this.scaleAtDepth(backZ);
			
			const scx = this.screenCenterX, scy = this.screenCenterY;
			
			if( scx + backScale * (vbb.maxX + pos.x) <= this.clip.minX ) return;
			if( scx + backScale * (vbb.minX + pos.x) >= this.clip.maxX ) return;
			if( scy + backScale * (vbb.maxY + pos.y) <= this.clip.minY ) return;
			if( scy + backScale * (vbb.minY + pos.y) >= this.clip.maxY ) return;
			
			// guess!
			const rezo = 1 << Math.ceil( Math.log(this.scaleAtDepth(pos.z))/Math.log(2) );
			
			const drawPromises:Thenable<void>[] = [];
			if( entityClass.visualRef ) {
				drawPromises.push(this.imageCache.fetchVisualImageSlice(entityClass.visualRef, entity.state, this.time, orientation, rezo ).then( (imageSlice) => {
					const scale = this.scaleAtDepth(pos.z + imageSlice.bounds.minZ/this.unitPpm);
					const sx = scx + pos.x*scale;
					const sy = scy + pos.y*scale;
					this.sciAddImageSlice(sx, sy, pos.z, orientation, scale, imageSlice);
					return;
				}));
			}
			eachSubEntity( pos, orientation, entity, this.gameDataManager, (subPos, subOri, subEnt) => {
				drawPromises.push(this.wcdAddEntity(subPos, subOri, subEnt));
			}, this );
			
			return voidify(Promise.all(drawPromises));
		});
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

function imageParamsKey( visualRef:VisualRef, state:KeyedList<any>|undefined, time:number, orientation:Quaternion, resolution:number ):ImageParamsKey {
	if( state == null ) state = {};
	return JSON.stringify({
		visualRef, state, time, orientation, resolution
	});
}

interface VisualMetadata {
	/** Hash-based URN of the visual object */
	hardVisualRef : string;
	/** Whether state affects this visual at all */
	variesBasedOnState : boolean;
	/** Total animation length, taking into account that frames may themselves be visuals */
	animationLength : number;
	
	discreteAnimationStepCount : number;
}

const EMPTY_IMAGE_SLICE_PROMISE = resolvedPromise(EMPTY_IMAGE_SLICE);

const objectRefRegex = /^urn:.*/;

export class VisualImageManager {
	/**
	 * May use RenderingContext.dictionaryRootRef
	 * as part of a cache key,
	 * but will rely on gameDataManager to actually do lookups
	 */
	public constructor( protected renderingContext:RenderingContext, protected gameDataManager:GameDataManager ) { }
	
	protected visualMetadataCache = new Map<VisualRef,Thenable<VisualMetadata>>();
	
	protected resolveToHardVisualRef( ref:string ):Promise<string> {
		if( ref.match(/^urn:uuid:/) ) {
			return this.gameDataManager.fetchHardRef(ref);
		} else {
			return Promise.resolve(ref);
		}
	}
	
	protected visualCache = new Map<VisualRef, Thenable<Visual>>();
	
	protected fetchVisual( visualRef:VisualRef ):Thenable<Visual> {
		let prom = this.visualCache.get(visualRef);
		if( prom ) return prom;
		
		prom = resolveWrap(new Promise<Visual>( (resolve,reject) => {
			const bitImgRer = isBitImageVisualRef(visualRef);
			if( bitImgRer ) return resolve(parseBitImageVisualRefRegexResult(bitImgRer));
			
			if( objectRefRegex.exec(visualRef) ) {
				return resolve(this.gameDataManager.fetchObject<Visual>(visualRef));
			}
			
			return reject(new Error("Unsupported visual ref "+visualRef));
		}));
		
		this.visualCache.set(visualRef, prom);
		return prom;
	}
	
	protected fetchVisualMetadata( visualRef:string ):Thenable<VisualMetadata> {
		let md = this.visualMetadataCache.get(visualRef);
		if( md ) return md;
		
		md = resolveWrap(this.resolveToHardVisualRef(visualRef).then( (hardVisualRef) => {
			return this.fetchVisual(hardVisualRef).then( (visual:Visual):Promise<VisualMetadata>|VisualMetadata => {
				switch( visual.classRef ) {
				case "http://ns.nuke24.net/Game21/BitImageVisual":
					return {
						hardVisualRef,
						variesBasedOnState: false,
						animationLength: 0,
						discreteAnimationStepCount: 1,
					};
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
	
	protected fetchVisualImageParamsKey( visualRef:VisualRef, state:KeyedList<any>|undefined, time:number, orientation:Quaternion, resolution:number ):Thenable<ImageParamsKey> {
		const mdp = this.fetchVisualMetadata(visualRef);
		
		return shortcutThen(mdp, (md) => {
			return imageParamsKey(
				md.hardVisualRef, (md.variesBasedOnState ? state||{} : {}),
				md.animationLength == 0 ? 0 : time - time / md.animationLength,
				orientation, resolution); 
		});
	}
	
	protected generateVisualRgbaSlice(
		visualRef:VisualRef, state:KeyedList<any>|undefined, time:number, orientation:Quaternion, preferredResolution:number
	):Thenable<ImageSlice<Uint8ClampedArray>> {
		return this.fetchVisual(visualRef).then( (visual) => {
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
					const animationTime  = animationLength == 0 ? 0 : time - animationLength * Math.floor(time / animationLength);
					const animationPhase = animationTime / animationLength;
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
						props.visualRef, {}, time, orientation, preferredResolution
					);
				});
			default:
				return Promise.reject(new Error("Don't yet know how to generateVisualRgbaSlice a"+visual.classRef));
			}
		});
	}
	
	public fetchRefOnlyVisualImageSlice( visualRef:VisualRef, state:KeyedList<any>|undefined, time:number, orientation:Quaternion, preferredPpm:number ):Thenable<ImageSlice<HTMLImageElement|undefined>> {
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
		
		// In all other cases we gotta do it the hard way.
		const paramsKPromise = this.fetchVisualImageParamsKey(visualRef, state, time, orientation, resolution); 
		return shortcutThen<string, ImageSlice<HTMLImageElement|undefined>>(paramsKPromise, (k:string):Thenable<ImageSlice<HTMLImageElement|undefined>> => {
			let sliceProm:Thenable<ImageSlice<HTMLImageElement|undefined>>|undefined = this.paramsKeyedVisualImageCache.get(k);
			if( sliceProm ) return sliceProm;
			
			sliceProm = this.generateVisualRgbaSlice(
				visualRef, state, time, orientation, resolution
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
			
			sliceProm = resolveWrap(sliceProm);
			this.paramsKeyedVisualImageCache.set(k, sliceProm);
			return sliceProm;
		});
	}
	
	public fetchVisualImageSlice( visualRef:VisualRef, state:KeyedList<any>|undefined, time:number, orientation:Quaternion, preferredPpm:number ):Thenable<ImageSlice<HTMLImageElement>> {
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
	public qetVisualImageSlice( visualRef:VisualRef, state:KeyedList<any>|undefined, time:number, orientation:Quaternion, preferredPpm:number ):ImageSlice<HTMLImageElement>|undefined {
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
					return this.fetchVisualImageSlice(entityClass.visualRef, entity.state, time, orientation, preferredPpm);
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
				enRen.time = time;
				return enRen.wcdAddEntity( ZERO_VECTOR, orientation, entity ).then( () => {
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
