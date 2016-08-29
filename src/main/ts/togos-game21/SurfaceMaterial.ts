import LightColor from './LightColor';
import SurfaceColor from './SurfaceColor';

export interface SurfaceMaterialLayer {
	glow:LightColor;
	diffuse:SurfaceColor;
	/** 0 = perfect mirror, 1 = drywall, >1 = subsurface scattering */
	ruffness:number;
	indexOfRefraction:number;
}

interface SurfaceMaterial {
	title:string;
	/** Layers listed from inner-to-outermost */
	layers:SurfaceMaterialLayer[];
}

export default SurfaceMaterial;
