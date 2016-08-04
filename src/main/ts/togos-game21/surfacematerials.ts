import KeyedList from './KeyedList';
import { deepFreeze } from './DeepFreezer';
import SurfaceColor from './SurfaceColor';
import SurfaceMaterial, { SurfaceMaterialLayer } from './SurfaceMaterial';

export const MATERIAL_MAP_SIZE = 256;

/** An array providing a material reference for each 0..255 index */
type MaterialPalette = Array<string>;
/** A palette with refs resolved to actual material objects */
type MaterialMap = Array<SurfaceMaterial>;
/** Given a material map, a 'remap' can map indexes to different indexes
 * (e.g. to turn indicator lights on and off without modifying the image data) */
type MaterialRemap = Uint8Array;


export const NONE:SurfaceMaterial = { title: "nothing", layers: [] };
export const UNDEFINED:SurfaceMaterial = { title: "undefined", layers: [
	{ ruffness: 0.5, diffuse: new SurfaceColor(1,0,1,1) }
] };

export function randomMaterials(count:number):Array<SurfaceMaterial> {
	let r = Math.random();
	let g = Math.random();
	let b = Math.random();
	const vari = Math.random()*0.5;
	const materials:SurfaceMaterial[] = [];
	for( let i=0; i < count; ++i ) {
		materials.push({
			title: "random material "+i,
			layers: [
				{
					ruffness: Math.random(),
					diffuse: new SurfaceColor(	r, g, b ),
				}
			]
		});
		r += (Math.random()-0.5)*vari;
		g += (Math.random()-0.5)*vari;
		b += (Math.random()-0.5)*vari;
	}
	return materials;
}

export function randomMaterialMap():Array<SurfaceMaterial> {
	const map:Array<SurfaceMaterial> = [
		NONE,
		NONE,
		NONE,
		NONE,
	]
	for( var i=4; i<256; i += 4 ) {
		map.splice(map.length, 0, ...randomMaterials(4));
	}
	// TODO: Generate indicator light, etc, according to their type
	return map;
};

const undefRef  = 'urn:uuid:18693b6c-7ace-4c4c-85e7-a5fb082d205e';
const noneRef   = 'urn:uuid:0c467f1b-06a8-4bd7-a0a4-805835ab599a';
const steel0Ref = 'urn:uuid:9f5a50ef-8c7e-48db-85bf-c7a6d55a58fe';
const steel1Ref = 'urn:uuid:9e5ffb1d-3c67-4321-8668-26f9925e3d97';
const steel2Ref = 'urn:uuid:303a9e78-cb7c-4d3c-9e2f-4b5d6debd001';
const steel3Ref = 'urn:uuid:e0331ac1-a07b-4b20-b46a-0c4776235da8';
const ps0Ref    = 'urn:uuid:09c2feeb-a050-4931-85de-efc4a12aacfb';
const ps1Ref    = 'urn:uuid:b29bc460-4c9d-43e3-a3d2-f9a4114ac9f9';
const ps2Ref    = 'urn:uuid:1ba047d0-6fdf-4bd1-bf94-db57c77cfd74';
const ps3Ref    = 'urn:uuid:624f532a-b37b-43be-aedf-d1d3a361191b';
const folg0Ref  = 'urn:uuid:c7a19722-d114-4b76-8c6a-51686ccf56aa';
const folg1Ref  = 'urn:uuid:80d1a0c5-d621-40b4-94fd-21453c1d70cd';
const folg2Ref  = 'urn:uuid:f70c6929-68ba-4c4e-9ae9-254b9dcb609e';
const folg3Ref  = 'urn:uuid:d0c90575-fba9-41f1-888b-0339f0f4a498';
const wood0Ref  = 'urn:uuid:4b73a4f5-d717-4907-9435-3004e0a5087d';  
const wood1Ref  = 'urn:uuid:de11e708-17d9-46ec-a58c-58cb897b8b47';
const wood2Ref  = 'urn:uuid:ea0f7659-4e74-4b29-9324-9d40f27ce897';
const wood3Ref  = 'urn:uuid:5e820a3a-6457-4550-8909-2cff51b8b1a6';
const bark0Ref  = 'urn:uuid:ea6ae5c8-5c01-49b9-9d59-4d74a7a15079';
const bark1Ref  = 'urn:uuid:9e2aea33-9210-49ad-b6b1-85ea8587a922';
const bark2Ref  = 'urn:uuid:30a6bfe8-7afa-47da-a651-3e7fa7884ab0';
const bark3Ref  = 'urn:uuid:603f6da3-f6ce-4bd8-87c2-01556cea502a';
const bark4Ref  = 'urn:uuid:15ac9b6e-6242-4e97-bf91-02d881d93c05';
/*
CHECK OUT THSI AWSUM WEB SIGHT https://www.uuidgenerator.net/;


;
;
'urn:uuid:3cf9be1b-f6c0-483a-b1e0-1af390f35974';
'urn:uuid:5b8d89b1-0f26-4987-8c56-218c1435e639';
'urn:uuid:f9595a26-ae24-4948-84c7-6928d60ff52b';
'urn:uuid:3184d81d-843f-4a24-b7f8-6dd0c4c014b0';
'urn:uuid:36f70539-70b0-479b-8739-eb528f1da3f6';
'urn:uuid:bc1e5d12-6b48-45f5-879c-ccae533639f7';
*/

function rgbsc(r:number,g:number,b:number,a:number=255):SurfaceColor {
	return new SurfaceColor(r/255,g/255,b/255,a/255);
}

function sml(ruff:number,r:number,g:number,b:number,a:number=255):SurfaceMaterialLayer {
	return { ruffness:ruff, diffuse:rgbsc(r,g,b,a) }
}

function smat(title:string, ...layers:SurfaceMaterialLayer[] ) : SurfaceMaterial {
	return { title: title, layers: layers };
}

export const DEFAULT_MATERIALS:KeyedList<SurfaceMaterial> = {
	[noneRef]: NONE,
	[steel0Ref]: {
		title: "gray steel 0", 
		layers: [
			{
				ruffness: 0.5,
				diffuse: new SurfaceColor(1.0,1.0,0.9,1.0),
			},
			{
				ruffness: 1/8,
				diffuse: new SurfaceColor(1.0,1.0,0.9,0.5),
			},
		]
	},
	[steel1Ref]: {
		title: "gray steel 1",
		layers: [
			{
				ruffness: 0.5,
				diffuse: new SurfaceColor(1.0,0.9,0.9,1.0),
			},
			{
				ruffness: 1/8,
				diffuse: new SurfaceColor(1.0,0.9,0.9,0.5),
			},
		],
	},
	[steel2Ref]: {
		title: "black steel 0",
		layers: [
			{
				ruffness: 1/8,
				diffuse: new SurfaceColor(1.0,0.8,0.7,1.0)
			},
		],
	},
	[steel3Ref]: {
		title: "black steel 1",
		layers: [
			{
				ruffness: 1/8,
				diffuse: new SurfaceColor(1.0,0.7,0.8)
			}
		],
	},
	// 8-11 (reddish stone)
	[ps0Ref]: {
		title: "pink stone 0",
		layers: [
			{
				ruffness: 1.0,
				diffuse: new SurfaceColor(0.70,0.30,0.2)
			},
			{
				ruffness: 1/16,
				diffuse: new SurfaceColor(0.70,0.30,0.2,0.2)
			},
		],
	},
	[ps1Ref]: {
		title: "pink stone 1",
		layers: [
			{
				ruffness: 1.0,
				diffuse: new SurfaceColor(0.65,0.30,0.20)
			},
			{
				ruffness: 1/16,
				diffuse: new SurfaceColor(0.70,0.30,0.2,0.2)
			},
		],
	},
	[ps2Ref]: {
		title: "pink stone 2",
		layers: [ {
			ruffness: 1.0,
			diffuse: new SurfaceColor(0.60,0.25,0.15)
		} ],
	},
	[ps3Ref]: {
		title: "pink stone 3",
		layers: [ {
			ruffness: 1.0,
			diffuse: new SurfaceColor(0.55,0.20,0.15)
		} ],
	},
	[folg0Ref]: {
		title: "light green foliage",
		layers: [
			{
				ruffness: 1.5,
				diffuse: rgbsc(104,111,73),
			},
			{
				ruffness: 0.5,
				diffuse: rgbsc(153,229,130,64),
			},
		],
	},
	[folg1Ref]: {
		title: "medium green foliage",
		layers: [
			{
				ruffness: 1.5,
				diffuse: rgbsc(52,133,28),
			},
			{
				ruffness: 0.5,
				diffuse: rgbsc(61,157,3,64),
			},
		],
	},
	[folg2Ref]: {
		title: "vibrant yellow-green foliage",
		layers: [
			{
				ruffness: 1.2,
				diffuse: rgbsc(124,195,23),
			}
		],
	},
	[folg3Ref]: {
		title: "dark blue-green foliage",
		layers: [
			{
				ruffness: 1.2,
				diffuse: rgbsc(25,109,62),
			}
		],
	},
	[bark0Ref]: smat("light gray bark", sml(1.1, 173,146,125)),
	[bark1Ref]: smat("medium gray bark", sml(1.1, 124,111,102)),
	[bark2Ref]: smat("dark gray bark", sml(1.1, 75,66,59)),
	[bark3Ref]: smat("medium brown bark", sml(1.1, 155,90,61)),
	[bark4Ref]: smat("medium brown bark", sml(1.0, 66,28,12)),
};
deepFreeze(DEFAULT_MATERIALS, true);

export const DEFAULT_MATERIAL_PALETTE_REF = 'urn:uuid:c05743d0-488c-4ff6-a667-bdca2c6f91d8'; // TODO: should be a urn:sha1:...# dealio

export const DEFAULT_MATERIAL_PALETTE:Array<string> = deepFreeze([
	noneRef,
	noneRef,
	noneRef,
	noneRef,
	steel0Ref,
	steel1Ref,
	steel2Ref,
	steel3Ref,
	ps0Ref,
	ps1Ref,
	ps2Ref,
	ps3Ref,
	// 12-15: foliage
	folg0Ref,
	folg1Ref,
	folg2Ref,
	folg3Ref,
	// 16-23: bark
	bark0Ref,
	bark1Ref,
	bark2Ref,
	bark3Ref,
	bark4Ref,
   // 21
   // 22
   // 23
]);

export const DEFAULT_MATERIAL_MAP:MaterialMap = deepFreeze(paletteToMap(DEFAULT_MATERIAL_PALETTE, DEFAULT_MATERIALS));

export const IDENTITY_MATERIAL_REMAP:MaterialRemap = new Uint8Array(256);
for( let i=0; i<256; ++i ) IDENTITY_MATERIAL_REMAP[i] = i;
deepFreeze(IDENTITY_MATERIAL_REMAP, true);

export function paletteToMap(palette:Array<string|undefined>, materials:KeyedList<SurfaceMaterial|undefined>):Array<SurfaceMaterial> {
	const map:Array<SurfaceMaterial> = []; //palette.map( (i) => materials[i] );
	for( let i=0; i < 256; ++i ) {
		const matId = palette[i];
		const mat = matId == null ? UNDEFINED : materials[matId];
		if( mat == null ) throw new Error("No such material "+matId+" (while building material map from palette)");
		map.push(mat);
	}
	// while( map.length < 256 ) map.push(UNDEFINED);
	return map;
}

/**
 * Think of this kind of like matrix multiplcation.
 * material map * material remap = material map with additional transformations
 */
export function remap(map:Array<SurfaceMaterial>, remap:MaterialRemap, dest?:Array<SurfaceMaterial>):Array<SurfaceMaterial> {
	if( !dest ) {
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
