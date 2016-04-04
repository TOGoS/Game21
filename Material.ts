import SurfaceColor from './SurfaceColor';

class Material {
	public diffuse:SurfaceColor;
	
	public static NONE:Material = { diffuse: SurfaceColor.NONE };
}

export default Material;
