import ProceduralShape from './ProceduralShape';
import ShapeSheet from './ShapeSheet';
import ImageSlice from './ImageSlice';
import Animation from './Animation';
import Material from './Material';
import {IDENTITY_MATERIAL_REMAP} from './Materials';
import Rectangle from './Rectangle';
import Quaternion from './Quaternion';
import Vector3D from './Vector3D';

export enum VisualBasisType {
	PROCEDURAL,
	SHAPESHEET
}

/**
 * A thing from which an ImageSlice<Image> can be generated.
 * Represents the state of an object at a single point in its
 * animation for a single state.
 * 
 * Lights and material map will be provided.
 * The data contained herein represents the shape of the
 * object, and can also override the material map
 * (e.g. for this frame, material #98 on the shape should be drawn as #100 from the input map)
 * 
 * In theory, for procedural ones, animation could be defined
 * passing t into the procedural shape.
 */
export class ObjectVisualFrame {
	public visualBasisType:VisualBasisType;
	public materialRemap:Uint8Array = IDENTITY_MATERIAL_REMAP;
	public shape:ProceduralShape|ImageSlice<ShapeSheet>
}

export class ObjectVisualState {
	/** Orientation depicted by this state */
	public orientation:Quaternion;
	
	// Not sure how flags will work; here's a guess.
	// Need to define flags
	public applicabilityFlagsMin:number;
	public applicabilityFlagsMax:number;
	
	public materialRemap:Uint8Array = IDENTITY_MATERIAL_REMAP;
	// The animation to show for this state
	public animation:Animation<ObjectVisualFrame>;
}

export default class ShapeSheetObjectVisual {
	public materialMap : Array<Material>;
	public states : Array<ObjectVisualState>;
}

// Alternatives to shape sheet visual:
//   procedural visual: a function that's called with the object's orientation and other properties to generate a shape sheet
