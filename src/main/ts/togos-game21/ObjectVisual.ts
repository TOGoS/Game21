import ProceduralShape from './ProceduralShape';
import ShapeSheet from './ShapeSheet';
import ImageSlice from './ImageSlice';
import Animation from './Animation';
import Material from './Material';
import {IDENTITY_MATERIAL_REMAP} from './materials';
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
export interface ObjectVisualFrame {
	visualBasisType : VisualBasisType;
	materialRemap? : Uint8Array;
	shapeRef? : string;
	shape? : ProceduralShape|ImageSlice<ShapeSheet>
}

export interface ObjectVisualState {
	/** Orientation depicted by this state */
	orientation:Quaternion;
	
	// Not sure how flags will work; here's a guess.
	// Need to define flags
	applicabilityFlagsMin:number;
	applicabilityFlagsMax:number;
	
	materialRemap? : Uint8Array;
	// The animation to show for this state
	animationRef? : string;
	animation? : Animation<ObjectVisualFrame>;
}

/**
 * Material Agnostic Object Visual; all the information except the material map
 * (though states and animation frames may still remap materials)
 */
export interface MAObjectVisual {
	states:Array<ObjectVisualState>;
}

export interface ObjectVisual {
	materialPaletteRef? : string;
	materialMap? : Array<Material>;
	maVisualRef? : string;
	maVisual? : MAObjectVisual;
}

export default ObjectVisual;

// Alternatives to shape sheet visual:
//   procedural visual: a function that's called with the object's orientation and other properties to generate a shape sheet
