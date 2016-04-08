import Rectangle from './Rectangle';
import TransformationMatrix3D from './TransformationMatrix3D';
import ShapeSheetUtil from './ShapeSheetUtil';

interface ProceduralShape {
	estimateOuterBounds( xf:TransformationMatrix3D ):Rectangle;
	draw( ssu:ShapeSheetUtil, xf:TransformationMatrix3D );
}

export default ProceduralShape;
