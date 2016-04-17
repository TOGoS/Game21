import DeepFreezer from './DeepFreezer';
import SurfaceColor from './SurfaceColor';
import Material from './Material';

export const MATERIAL_MAP_SIZE = 256;

export function randomMaterials(count:number):Array<Material> {
	let r = Math.random();
	let g = Math.random();
	let b = Math.random();
	const vari = Math.random()*0.5;
	const materials = [];
	for( let i=0; i < count; ++i ) {
		materials.push({
			diffuse: new SurfaceColor(
				r, g, b
			),
		});
		r += (Math.random()-0.5)*vari;
		g += (Math.random()-0.5)*vari;
		b += (Math.random()-0.5)*vari;
	}
	return materials;
}

function fillOutMaterialMap(map:Array<Material>):void {
	for( let i=0; i < MATERIAL_MAP_SIZE; ++i ) {
		if( map[i] == null ) {
			map[i] = {
				diffuse: new SurfaceColor(
					0.9+(Math.random()-0.5)*0.1,
					0.0+(Math.random()-0.5)*0.1,
					0.9+(Math.random()-0.5)*0.1,
					0.5
				)
			};
		}
	}
}

export function randomMaterialMap():Array<Material> {
	const map:Array<Material> = [
		Material.NONE,
		Material.NONE,
		Material.NONE,
		Material.NONE,
	]
	for( var i=4; i<256; i += 4 ) {
		map.splice(map.length, 0, ...randomMaterials(4));
	}
	// TODO: Generate indicator light, etc, according to their type
	return map;
};

export const DEFAULT_MATERIALS:Array<Material> = [
	// 0-3 (reserved)
	Material.NONE,
	Material.NONE,
	Material.NONE,
	Material.NONE,
	// 4-7 (steel)
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
	// 8-11 (reddish stone)
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
fillOutMaterialMap(DEFAULT_MATERIALS);

export const IDENTITY_MATERIAL_REMAP:Uint8Array = new Uint8Array(256);
for( let i=0; i<256; ++i ) IDENTITY_MATERIAL_REMAP[i] = i;
DeepFreezer.deepFreeze(IDENTITY_MATERIAL_REMAP);

export function remap(map:Array<Material>, remap:Uint8Array, dest:Array<Material>=new Array<Material>(MATERIAL_MAP_SIZE)):Array<Material> {
	for( let i=0; i<MATERIAL_MAP_SIZE; ++i ) {
		map[i] = map[remap[i]];
	}
	return dest;
}
