import SurfaceColor from './SurfaceColor';

export interface SurfaceMaterialLayer {
	diffuse:SurfaceColor;
	/** 0 = perfect mirror, 1 = drywall, >1 = subsurface scattering */
	ruffness:number;
	// TODO: some way to indicate glow color, which may vary based on surface angle
}

interface SurfaceMaterial {
	title:string;
	/** Layers listed from inner-to-outermost */
	layers:SurfaceMaterialLayer[];
}

export default SurfaceMaterial;
