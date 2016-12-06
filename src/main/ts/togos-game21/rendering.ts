/// <reference path="../Map.d.ts"/>

import KeyedList from './KeyedList';
import DirectionalLight from './DirectionalLight';
import Quaternion from './Quaternion';
import ImageSlice from './ImageSlice';
import { MaterialPalette } from './surfacematerials';
import GameDataManager from './GameDataManager';
import { isResolved, resolvedPromise, value, resolveWrap, shortcutThen } from './promises';
import { imageFromUrlPromise } from './images';

// TODO:
// When done, this should obsolete CanvasWorldView and ObjectImageManager.
// So delete those.

import DynamicEntityVisual from './DynamicEntityVisual';
import CompoundVisual from './CompoundVisual';
import BitImageVisual from './BitImageVisual';

import { isBitImageVisualRef, parseBitImageVisualRefRegexResult, bitImageVisualToRgbaData } from './bitimages';

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

export class EntityRenderer {
	public constructor( protected canvas:HTMLCanvasElement, imageCache:ImageCache ) { }
}

export class WorldRenderer extends EntityRenderer {
	// TODO: Copy stuff from CanvasWorldView
}

function fixImageSliceImage( slice:ImageSlice<HTMLImageElement|undefined> ):Thenable<ImageSlice<HTMLImageElement>> {
	if( slice.sheet == null ) return shortcutThen( imageFromUrlPromise(slice.sheetRef), (img) => {
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
	hardVisualRef : string;
	variesBasedOnState : boolean;
	animationLength : number;
	discreteAnimationStepCount : number;
}

export class ImageCache {
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
		
		prom = new Promise<Visual>( (resolve,reject) => {
			const bitImgRer = isBitImageVisualRef(visualRef);
			if( bitImgRer ) return resolve(parseBitImageVisualRefRegexResult(bitImgRer));
			
			return reject(new Error("Unsupported visual ref "+visualRef));
		});
		
		resolveWrap(prom);
		this.visualCache.set(visualRef, prom);
		return prom;
	}
	
	protected fetchVisualMetadata( visualRef:string ):Thenable<VisualMetadata> {
		let md = this.visualMetadataCache.get(visualRef);
		if( md ) return md;
		
		md = this.resolveToHardVisualRef(visualRef).then( (hardVisualRef) => {
			return this.fetchVisual(hardVisualRef).then( (visual:Visual):Promise<VisualMetadata>|VisualMetadata => {
				console.log("Loaded "+hardVisualRef+"; now we can make its metadata!");
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
		});
		
		resolveWrap(md);
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
		console.log("Fetching "+visualRef+" in order to generate RGBA...");
		return this.fetchVisual(visualRef).then( (visual) => {
			console.log("Loaded "+visualRef+"; now we can turn it into a picture!");
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
				console.log("Made an RGBA slice!  Now we can make it into image data...");
				if( rgbaSlice.bounds.minX != 0 || rgbaSlice.bounds.minY != 0 ) {
					// We're assuming that the rgbaSlice corresponds 1-1 with its rgbaData.
					return Promise.reject(new Error("Ack!"));
				}
				const dataUri = rgbaDataToImageDataUri(rgbaSlice.sheet, rgbaSlice.bounds.maxX, rgbaSlice.bounds.maxY );
				console.log("Made image data!", dataUri);
				return Promise.resolve(<ImageSlice<HTMLImageElement|undefined>>{
					sheetRef: dataUri,
					sheet: undefined,
					origin: rgbaSlice.origin,
					bounds: rgbaSlice.bounds,
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
			console.log("Not resulved yet; waiting...");
			return st.then( fixImageSliceImage );
		} 
	}
}
