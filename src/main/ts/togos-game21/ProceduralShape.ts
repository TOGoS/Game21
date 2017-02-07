import Rectangle from './Rectangle';
import AnimationMetadata from './AnimationMetadata';
import TransformationMatrix3D from './TransformationMatrix3D';
import ShapeSheetUtil from './ShapeSheetUtil';
import KeyedList from './KeyedList';

export interface ProceduralShapeParameters {
	/** Animation phase, 0-1 */
	t: number;
	entityState: KeyedList<any>;
}

interface ProceduralShape extends AnimationMetadata {
	estimateOuterBounds( params:ProceduralShapeParameters, xf:TransformationMatrix3D ):Rectangle;
	draw( ssu:ShapeSheetUtil, params:ProceduralShapeParameters, xf:TransformationMatrix3D ):void;
}

export default ProceduralShape;
