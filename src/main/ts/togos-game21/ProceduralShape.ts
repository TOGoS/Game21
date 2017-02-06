import Rectangle from './Rectangle';
import AnimationMetadata from './AnimationMetadata';
import TransformationMatrix3D from './TransformationMatrix3D';
import ShapeSheetUtil from './ShapeSheetUtil';

interface ProceduralShape extends AnimationMetadata {
	/**
	 * @param {number} t a number between 0 and 1 indicating the point in the object's animation that we are drawing
	 */
	estimateOuterBounds( t:number, xf:TransformationMatrix3D ):Rectangle;
	draw( ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D ):void;
}

export default ProceduralShape;
