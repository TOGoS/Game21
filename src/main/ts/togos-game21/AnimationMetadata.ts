import {AnimationCurveName} from './AnimationCurve';

/**
 * Metadata about animated things
 * that can be used to determine whether and how often they are animated.
 */
interface AnimationMetadata {
	/**
	 * Total length of the animation, in seconds
	 */
	animationLength:number;
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
	discreteAnimationStepCount:number;
	/**
	 * How does animation work?  i.e. mapping from external time 
	 * (taking animationLength into account, so 0-1) to t. 
	 * Default to "none" if animationLength = 0,
	 * "loop" if animationLength != 0.
	 */
	animationCurveName:AnimationCurveName;
}

export default AnimationMetadata;
