import KeyedList from './KeyedList';
import TransformationMatrix3D from './TransformationMatrix3D';

/** properties expression input */
interface EntityVisualPropertiesContext {
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
interface EntityVisualProperties {
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
 * A visual that uses a TOGVM expression
 * to determine its appearance
 */
interface DynamicEntityVisual {
	classRef: "http://ns.nuke24.net/Game21/DynamicEntityVisual";
	/** Length, in seconds; 0 for non-animated things */
	animationLength:number;
	/**
	 * Number of discrete animation steps; may be Infinity if continuous.
	 * It may be assumed that within a step, all other context being the same,
	 * the properties expression would return the same thing.
	 * 
	 * The visual referenced by returned properties may itself
	 * be animated, potentially at a different rate.
	 */
	discreteAnimationStepCount:number;
	/**
	 * References an expression that will be evaluated
	 * with a EntityVisualPropertiesContext as variables
	 * and returns a EntityVisualProperties.
	 */
	propertiesExpressionRef:string;
}

export default DynamicEntityVisual;
