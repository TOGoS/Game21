import ImageSlice from './ImageSlice';
import ShapeSheet from './ShapeSheet';
import ProceduralShape from './ProceduralShape';
import Animation from './Animation';
import { ObjectVisual, MAObjectVisual, ObjectVisualState, ObjectVisualFrame, VisualBasisType } from './ObjectVisual';
import TransformationMatrix3D from './TransformationMatrix3D';
import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil from './ShapeSheetUtil';
import Material from './Material';
import {remap} from './Materials';
import {DEFAULT_LIGHTS} from './Lights';

/*
const oneCount = function(n:number):number {
	n = n >>> 0;
	let count=0;
	while( n != 0 ) {
		if( (n & 1) == 1 ) ++count;
		n >>>= 1;
	}
	return n;
}
*/

/**
 * Calculates how many flags of num bitwisely fall outside of minFlags..maxFlags 
 */
const flagDiff = function(minFlags:number, num:number, maxFlags:number):number {
	let diff=0;
	num |= 0;
	minFlags |= 0;
	maxFlags |= 0;
	for( let i=0, checkFlag = 1; i<32; ++i, checkFlag <<= 1 ) {
		if( (maxFlags & checkFlag) == 0 ) if( (num && checkFlag) == checkFlag ) ++diff;
		if( (minFlags & checkFlag) == checkFlag ) if( (num && checkFlag) == 0 ) ++diff;
	}
	return diff;
}

declare function Symbol(name:string):symbol;

const LAST_REQUESTED:symbol = Symbol("LAST_REQUESTED");

interface LastRequestedCache {
	flags : number;
	animationLength : number;
	animationPhase : number;
	orientation : Quaternion;
	resolution : number;
	imageSlice : ImageSlice<HTMLImageElement>;
}

function phase( time:number, length:number ) {
	const count = time/length;
	return count - Math.floor(count);
}

export default class ObjectImageManager {
	public resolution:number = 16;
	protected lights = DEFAULT_LIGHTS;	
	
	public frameToShapeSheetSlice(ov:ObjectVisualFrame, t:number, orientation:Quaternion, preferredResolution:number):ImageSlice<ShapeSheet> {
		switch( ov.visualBasisType ) {
		case VisualBasisType.PROCEDURAL:
			return ShapeSheetUtil.proceduralShapeToShapeSheet(
				<ProceduralShape>ov.shape,
				orientation,
				preferredResolution
			);
		case VisualBasisType.SHAPESHEET:
			const shape:ImageSlice<ShapeSheet> = <ImageSlice<ShapeSheet>>ov.shape;
			if( orientation.a != 1 ) {
				throw new Error("Don't [yet] know how to rotate a ShapeSheet!");
			}
			return <ImageSlice<ShapeSheet>>ov.shape;
		default:
			throw new Error("Unsupported visual basis type: "+ov.visualBasisType);
		}
	}
	
	// Due to the differences between how procedural and shapesheet
	// visuals are to be handled, I expect these 2 functions to be combined into one big one.
	// Otherwise I have to look at visualBasisType twice.
	public frameToImageSlice(ov:ObjectVisualFrame, materials:Array<Material>, t:number, orientation:Quaternion, preferredResolution:number):ImageSlice<HTMLImageElement> {
		const shapeSheetSlice = this.frameToShapeSheetSlice(ov, t, orientation, preferredResolution);
		const croppedSheet = ShapeSheetUtil.autocrop(shapeSheetSlice, true);
		const image:HTMLImageElement = ShapeSheetRenderer.shapeSheetToImage(
			croppedSheet.sheet,
			remap(materials, ov.materialRemap),
			this.lights
		)
		return new ImageSlice<HTMLImageElement>(image, croppedSheet.origin, croppedSheet.resolution, croppedSheet.bounds);
	}
	
	public objectVisualState(visual:MAObjectVisual, flags:number, orientation:Quaternion):ObjectVisualState {
		if( visual.states.length == 1 ) return visual.states[0];
		
		// Find the closest match flag-wise,
		// then among those with the same flags,
		// find the one with the closest orientation. 
			
		let minFlagDifference = 65; // max flag difference is 64; this needs to be at least one higher
		let minOrientationDifference = 1;
		let closestState:ObjectVisualState = null;
		for( let s in visual.states ) {
			const state = visual.states[s];
			const d = flagDiff(state.applicabilityFlagsMin, flags, state.applicabilityFlagsMax);
			if( d > minFlagDifference ) continue;
			if( d < minFlagDifference ) {
				// Closer one flag-wise blows away anything else we've found
				minOrientationDifference = 1;
				closestState = state;
		} else {
				// Flag difference is equal, so compare orientations
				const da = orientation.a - state.orientation.a;
				const db = orientation.b - state.orientation.b;
				const dc = orientation.c - state.orientation.c;
				const dd = orientation.d - state.orientation.d;
				const orientationDiff = Math.sqrt(da*da + db*db + dc*dc + dd*dd);
				if( orientationDiff < minOrientationDifference ) {
					minOrientationDifference = orientationDiff;
					closestState = state;
				}
			}
		}
		
		return closestState;
	}
	
	/**
	 * Returns the 't' value(0...1) for the given time.
	 */
	protected animationPhase<T>(animation:Animation<T>, time:number):number {
		if( animation.length === Infinity ) return 0.5;
		return phase(time, animation.length);
	}
	
	protected frame<T>(animation:Animation<T>, t:number ):T {
		if( animation.length === Infinity ) return animation.frames[0];
		
		const frameNumber = Math.floor(t * animation.frames.length);
		return animation.frames[frameNumber];
	}
	
	public objectVisualImage(visual:ObjectVisual, flags:number, time:number, orientation:Quaternion, preferredResolution:number=this.resolution):ImageSlice<HTMLImageElement> {
		// TODO: Caching up the wazoo, at least for common cases (single state, identity orientation).
		// this function's going to be called for each object for each frame, so it's gotta be fast
		// and not do any real work or allocations 99% of the time.
		
		const lastRequested = <LastRequestedCache>(<any>visual)[LAST_REQUESTED];
		if(
			lastRequested &&
			(lastRequested.flags == null || lastRequested.flags == flags) &&
			(lastRequested.animationPhase == null || lastRequested.animationPhase == phase(time, lastRequested.animationLength)) &&
			Quaternion.areEqual(lastRequested.orientation, orientation) &&
			lastRequested.resolution == preferredResolution
		) {
			return lastRequested.imageSlice
		}
		
		// Still might check some other cache...
		
		const state = this.objectVisualState(visual.maVisual, flags, orientation);
		const frame = this.frame(state.animation, time);
		const t = this.animationPhase(state.animation, time);
		const imageSlice = this.frameToImageSlice(frame, remap(visual.materialMap, state.materialRemap), t, orientation, preferredResolution);
		(<any>visual)[LAST_REQUESTED] = <LastRequestedCache>{
			flags: visual.maVisual.states.length == 0 ? null : flags,
			animationLength: state.animation.length,
			animationPhase: state.animation.length == Infinity ? null : t,
			orientation: orientation,
			resolution: preferredResolution,
			imageSlice: imageSlice
		};
		return imageSlice;
	}
}
