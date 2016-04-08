import ShapeSheet from './ShapeSheet';
import Material from './Material';
import Rectangle from './Rectangle';
import Quaternion from './Quaternion';
import Vector3D from './Vector3D';

class ShapeSheetSlice {
	// When serialized, shapeSheet will be replaced with a hash-based shapeSheetRef
	/**
	 * @param {ShapeSheet} shapeSheet the shapesheet
	 * @param {Vector3D} origin gives the point on the shapesheet (relative
	 *   to the entire shapesheet, not the bounded area) that corresponds
	 *   to the object's position
	 * @param {number} resolution pixels per world unit (world unit being 'meters')
	 * @param {Rectangle} bounds the region of the shapesheet to be drawn
	 */
	public constructor(shapeSheet:ShapeSheet, public origin:Vector3D, public resolution:number, public bounds:Rectangle ) { }
}

class ShapeSheetAnimation {
	static ONEND_STOP = 0;
	static ONEND_LOOP = 1;
	
	public speed:number; // frames per second, let's say
	public onEnd:number; // how it acts when it's done
	public frames:Array<ShapeSheetSlice>; // Which slice to show for each frame
}

class ShapeSheetObjectVisualState {
	/** Orientation depicted by this state */
	public orientation:Quaternion;
	// Not sure how flags will work; here's a guess.
	// Need to define flags
	public applicabilityFlagsMin:number;
	public applicabilityFlagsMax:number;
	
	// The animation to show for this state
	public animation:ShapeSheetAnimation;
}

export default class ShapeSheetObjectVisual {
	public materialMap : Array<Material>;
	public frames : Array<ShapeSheetObjectVisualState>;
}

// Alternatives to shape sheet visual:
//   procedural visual: a function that's called with the object's orientation and other properties to generate a shape sheet
