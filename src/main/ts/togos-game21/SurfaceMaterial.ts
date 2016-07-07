import SurfaceColor from './SurfaceColor';

export interface SurfaceMaterialLayer {
	diffuse:SurfaceColor;
	roughness:number;
	/** 0 - no subsurface scattering; 1 - very scattery */
	subsurfaceScattering?:number;
}

interface SurfaceMaterial {
	title:string;
	/** Layers listed from inner-to-outermost */
	layers:SurfaceMaterialLayer[];
}

export default SurfaceMaterial;
