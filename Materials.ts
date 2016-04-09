import SurfaceColor from './SurfaceColor';
import Material from './Material';

export const DEFAULT_MATERIALS:Array<Material> = [
	// 0-3 (reserved)
	Material.NONE,
	Material.NONE,
	Material.NONE,
	Material.NONE,
	// 4-7 (primary material)
	{
		diffuse: new SurfaceColor(1.0,1.0,0.9)
	},
	{
		diffuse: new SurfaceColor(1.0,0.9,0.8)
	},
	{
		diffuse: new SurfaceColor(1.0,0.8,0.7)
	},
	{
		diffuse: new SurfaceColor(1.0,0.7,0.8)
	},
	// 8-11 (different material)
	{
		diffuse: new SurfaceColor(0.70,0.30,0.2)
	},
	{
		diffuse: new SurfaceColor(0.65,0.30,0.20)
	},
	{
		diffuse: new SurfaceColor(0.60,0.25,0.15)
	},
	{
		diffuse: new SurfaceColor(0.55,0.20,0.15)
	},
	// 12 (weird transparent thing for testing fog shader)
	{
		diffuse: new SurfaceColor(0.25,0.60,0.35,0.5)
	}
];
