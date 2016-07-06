import Rectangle from './Rectangle';
import { AnimationType } from './Animation';
import TransformationMatrix3D from './TransformationMatrix3D';
import ShapeSheetUtil from './ShapeSheetUtil';

interface ProceduralShape {
	/**
	 * Gives a hint for how this procedural shape is meant to be animated, if at all.
	 */
	animationType : AnimationType;
	/**
	 * @param {number} t a number between 0 and 1 indicating the point in the object's animation that we are drawing
	 */
	estimateOuterBounds( t:number, xf:TransformationMatrix3D ):Rectangle;
	draw( ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D ):void;
}

export default ProceduralShape;
