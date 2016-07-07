import SurfaceColor from './SurfaceColor';

export interface SurfaceMaterialLayer {
	diffuse:SurfaceColor;
	roughness:number;
}

interface SurfaceMaterial {
	title:string;
	/** Layers listed from inner-to-outermost */
	layers:SurfaceMaterialLayer[];
}

export default SurfaceMaterial;
