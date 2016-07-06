import SurfaceColor from './SurfaceColor';

class SurfaceMaterial {
	public title:string;
	public diffuse:SurfaceColor;
	
	public static NONE:SurfaceMaterial = { title: "nothing", diffuse: SurfaceColor.NONE };
	public static UNDEFINED:SurfaceMaterial = { title: "undefined", diffuse: new SurfaceColor(1,0,1,1) };
}

export default SurfaceMaterial;
