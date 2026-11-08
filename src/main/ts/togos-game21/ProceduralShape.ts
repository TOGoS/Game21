import Rectangle from './Rectangle.ts';
import { AnimationType } from './Animation.ts';
import TransformationMatrix3D from './TransformationMatrix3D.ts';
import ShapeSheetUtil from './ShapeSheetUtil.ts';

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
