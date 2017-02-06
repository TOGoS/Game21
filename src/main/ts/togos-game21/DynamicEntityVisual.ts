import KeyedList from './KeyedList';
import TransformationMatrix3D from './TransformationMatrix3D';
import { AnimationCurveName } from './AnimationCurve';

/** properties expression input */
export interface EntityVisualPropertiesContext {
	// entityClassRef:string; // That would be kind of redundant,
	// since the class indicates the visual, right?
	entityState:KeyedList<any>;
	// When generating a still frame,
	// animationTime/Phase will be set to the time
	// in the *middle* of the frame.
	// If there is only one frame, animationPhase will be 0.5.
	animationLength:number;
	animationFrameCount:number; // Infinity for continuous animations
	animationFrameNumber:number; // 0..frameCount-1 ; NaN for continuous animations
	animationTime:number; // Time since beginning of animation
	animationPhase:number; // Animation time / length
}

/** properties expression result */
export interface EntityVisualProperties {
	/** Any explicit material settings */
	materialRefOverrides:(string|undefined)[];
	/**
	 * Any additional material remapping
	 * (applies after material ref overrides)
	 */
	materialRemap:number[];
	/** Any additional transform to be applied to the visual */
	transformation:TransformationMatrix3D;
	/**
	 * Reference to another entity visual;
	 * This could be a simple image file,
	 * a shapesheet,
	 * or a procedural shape file.
	 */
	visualRef:string;
}

/**
 * Take the result of a visual properties exression
 * and mash it into something that's definitely a
 */
export function fixEntityVisualProperties(inProps:any, sourceRef:string):EntityVisualProperties {
	let materialRefOverrides:string[] = [];
	let materialRemap:number[] = [];
	let transformation:TransformationMatrix3D = TransformationMatrix3D.IDENTITY;
	let visualRef:string = "(DynamicEntityVisual expression "+sourceRef+" is broken)";
	
	if( inProps.visualRef != undefined ) {
		visualRef = ""+inProps.visualRef;
	}
	
	// TODO: Copy over other stuffs
	
	return {
		materialRefOverrides,
		materialRemap,
		transformation,
		visualRef
	}
}

/**
 * A visual that uses a TOGVM expression
 * to determine its appearance
 */
interface DynamicEntityVisual {
	classRef: "http://ns.nuke24.net/Game21/DynamicEntityVisual";
	/**
	 * Length, in seconds; 0 for non-animated things
	 * Default is zero, meaning non-animated,
	 * and other animation properties will be ignored.
	 */
	animationLength?:number;
	/**
	 * Number of discrete animation steps; may be Infinity if continuous.
	 * It may be assumed that within a step, all other context being the same,
	 * the properties expression would return the same thing.
	 * 
	 * The visual referenced by returned properties may itself
	 * be animated, potentially at a different rate.
	 * 
	 * For non-animated things, this should be 1.
	 * 
	 * Default is 1 for non-animated things, Infinity for animated things.
	 */
	discreteAnimationStepCount?:number;
	/**
	 * How does animation work?
	 * Default to "none" if animationLength = 0,
	 * "loop" if animationLength != 0.
	 */
	animationCurveName?:AnimationCurveName;
	/**
	 * References an expression that will be evaluated
	 * with a EntityVisualPropertiesContext as variables
	 * and returns a EntityVisualProperties.
	 */
	propertiesExpressionRef:string;
}

export default DynamicEntityVisual;
