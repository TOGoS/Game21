import KeyedList from './KeyedList';
import DirectionalLight from './DirectionalLight';
import Quaternion from './Quaternion';
import ImageSlice from './ImageSlice';
import { MaterialPalette } from './surfacematerials';
import GameDataManager from './GameDataManager';
import { isResolved, value, resolveWrap, shortcutThen } from './promises';
import { imageFromUrl } from './images';

type VisualRef = string;

interface RenderingContext {
	lights : KeyedList<DirectionalLight>;
	materialRefs : MaterialPalette;
	dictionaryRootRef : string;
}

export class EntityRenderer {
	public constructor( protected canvas:HTMLCanvasElement, imageCache:ImageCache ) { }
}

export class WorldRenderer extends EntityRenderer {
	// TODO: Copy stuff from CanvasWorldView
}

function fixImageSliceImage( slice:ImageSlice<HTMLImageElement> ):ImageSlice<HTMLImageElement> {
	if( slice.sheet == null ) slice.sheet = imageFromUrl(slice.sheetRef);
	return slice; 
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
	
	/**
	 * For entities that always look the same regardless of state or time
	 * RESO_K_OFFSET+log2(resolution:int) => visual ref => Thenable<ImageSlice<HTMLImageElement>>
	 */
	protected staticVisualImageCache: Map<VisualRef,Thenable<ImageSlice<HTMLImageElement>>>[] = [];
	
	protected visualMetadataCache: Map<VisualRef,Thenable<VisualMetadata>> = new Map();
	
	protected resolveToHardVisualRef( ref:string ):Promise<string> {
		if( ref.match(/^urn:uuid:/) ) {
			return this.gameDataManager.fetchHardRef(ref);
		} else {
			return Promise.resolve(ref);
		}
	}
	
	protected fetchVisualMetadata( visualRef:string ):Thenable<VisualMetadata> {
		let md = this.visualMetadataCache.get(visualRef);
		if( md ) return md;
		
		md = this.resolveToHardVisualRef(visualRef).then( (hardVisualRef):Promise<VisualMetadata> => {
			if( hardVisualRef.endsWith('#') ) {
				// It references some JSON-encoded thing!
			} else if( hardVisualRef.match('bitimg:') ) {
				// Oh that's great, too!
			}
			return Promise.reject("Lolz not implemented");
		});
		
		resolveWrap(md);
		this.visualMetadataCache.set(visualRef, md);
		return md;
	}
	
	/**
	 * Cache for images with more inputs.
	 */
	protected paramsKeyedVisualImageCache: Map<ImageParamsKey,Thenable<ImageSlice<HTMLImageElement>>> = new Map();
	
	protected fetchVisualImageParamsKey( visualRef:VisualRef, state:KeyedList<any>|undefined, time:number, orientation:Quaternion, resolution:number ):Thenable<ImageParamsKey> {
		const mdp = this.fetchVisualMetadata(visualRef);
		
		return shortcutThen(mdp, (md) => {
			return imageParamsKey(
				md.hardVisualRef, (md.variesBasedOnState ? state||{} : {}),
				md.animationLength == 0 ? 0 : time - time / md.animationLength,
				orientation, resolution); 
		});
	}
	
	public fetchRefOnlyVisualImageSlice( visualRef:VisualRef, state:KeyedList<any>|undefined, time:number, orientation:Quaternion, preferredPpm:number ):Thenable<ImageSlice<HTMLImageElement>> {
		const resoLog = Math.round(Math.log2(preferredPpm))
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
		return shortcutThen<string, ImageSlice<HTMLImageElement>>(paramsKPromise, (k:string):Thenable<ImageSlice<HTMLElement>> => {
			const v = this.paramsKeyedVisualImageCache.get(k);
			if( v ) return v;
			
			throw new Error("Ack fetchRefOnlyVisualImageSlice isn't implemented!");
		});
	}
	
	public fetchVisualImageSlice( visualRef:VisualRef, state:KeyedList<any>|undefined, time:number, orientation:Quaternion, preferredPpm:number ):Thenable<ImageSlice<HTMLImageElement>> {
		const st = this.fetchRefOnlyVisualImageSlice( visualRef, state, time, orientation, preferredPpm );
		if( isResolved(st) ) {
			fixImageSliceImage(value(st));
			return st;
		} else {
			return st.then( fixImageSliceImage );
		} 
	}
}
