import Rectangle from './Rectangle';
import TransformationMatrix3D from './TransformationMatrix3D';
import ShapeSheetUtil from './ShapeSheetUtil';

interface ProceduralShape {
	/**
	 * True if this shape draws differently depending on t.
	 * This might be useful to know when generating cache keys.
	 */
	isAnimated:boolean;
	/**
	 * @param {number} t a number between 0 and 1 indicating the point in the object's animation that we are drawing
	 */
	estimateOuterBounds( t:number, xf:TransformationMatrix3D ):Rectangle;
	draw( ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D ):void;
}

export default ProceduralShape;
