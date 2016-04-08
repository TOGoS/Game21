import ShapeSheet from './ShapeSheet';
import ImageSlice from './ImageSlice';
import Animation from './Animation';
import Material from './Material';
import Rectangle from './Rectangle';
import Quaternion from './Quaternion';
import Vector3D from './Vector3D';

type ShapeSheetSlice = ImageSlice<ShapeSheet>;

class ShapeSheetObjectVisualState {
	/** Orientation depicted by this state */
	public orientation:Quaternion;
	// Not sure how flags will work; here's a guess.
	// Need to define flags
	public applicabilityFlagsMin:number;
	public applicabilityFlagsMax:number;
	
	// The animation to show for this state
	public animation:Animation<ImageSlice<ShapeSheet>>;
}

export default class ShapeSheetObjectVisual {
	public materialMap : Array<Material>;
	public states : Array<ShapeSheetObjectVisualState>;
}

// Alternatives to shape sheet visual:
//   procedural visual: a function that's called with the object's orientation and other properties to generate a shape sheet
