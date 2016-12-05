import TransformationMatrix3D from './TransformationMatrix3D';

interface CompoundVisualComponent {
	transformation:TransformationMatrix3D;
	visualRef:string;
}

/**
 * Looks like a bunch of components!
 * This should probably only be used as a top level visual
 * and the components drawn directly,
 * rather than caching the compound visual as one big image.
 */
interface CompoundVisual {
	classRef: "http://ns.nuke24.net/Game21/CompoundVisual";
	components:CompoundVisualComponent[]
}

export default CompoundVisual;
