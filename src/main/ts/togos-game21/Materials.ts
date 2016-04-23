import { deepFreeze } from './DeepFreezer';
import SurfaceColor from './SurfaceColor';
import Material from './Material';

export const MATERIAL_MAP_SIZE = 256;

type MaterialMap = Array<Material>;
type MaterialRemap = Uint8Array;

export function randomMaterials(count:number):Array<Material> {
	let r = Math.random();
	let g = Math.random();
	let b = Math.random();
	const vari = Math.random()*0.5;
	const materials:Material[] = [];
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

export const DEFAULT_MATERIALS:MaterialMap = [
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

export const IDENTITY_MATERIAL_REMAP:MaterialRemap = new Uint8Array(256);
for( let i=0; i<256; ++i ) IDENTITY_MATERIAL_REMAP[i] = i;
deepFreeze(IDENTITY_MATERIAL_REMAP, true);

/**
 * Think of this kind of like matrix multiplcation.
 * material map * material remap = material map with additional transformations
 */
export function remap(map:Array<Material>, remap:MaterialRemap, dest:Array<Material>=null):Array<Material> {
	if( dest == null ) {
		// Then we can shortcut if there's nothing to do.
		if( remap == IDENTITY_MATERIAL_REMAP ) return map;
		// Otherwise make it so we can fill it in.
		dest = new Array(MATERIAL_MAP_SIZE);
	}
	for( let i=0; i<MATERIAL_MAP_SIZE; ++i ) {
		dest[i] = map[remap[i]];
	}
	return dest;
}

export function makeRemap(...stuff:number[]) {
	const remap = new Uint8Array(256);
	for( let i=0; i < 256; ++i ) remap[i] = i;
	for( let i=0; i < stuff.length; i += 3 ) {
		const dest0 = stuff[i];
		const source0 = stuff[i+1];
		const count = stuff[i+2];
		for( let j=0; j < count; ++j ) {
			remap[dest0+j] = source0+j;
		}
	}
	return remap;
}
