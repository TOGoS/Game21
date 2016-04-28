import SurfaceColor from './SurfaceColor';

class Material {
	public title:string;
	public diffuse:SurfaceColor;
	
	public static NONE:Material = { title: "nothing", diffuse: SurfaceColor.NONE };
	public static UNDEFINED:Material = { title: "undefined", diffuse: new SurfaceColor(1,0,1,1) };
}

export default Material;
