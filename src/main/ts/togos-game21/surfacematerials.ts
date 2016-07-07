import KeyedList from './KeyedList';
import { deepFreeze } from './DeepFreezer';
import SurfaceColor from './SurfaceColor';
import SurfaceMaterial from './SurfaceMaterial';

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
	{ roughness: 0.5, diffuse: new SurfaceColor(1,0,1,1) }
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
					roughness: Math.random(),
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
/*
CHECK OUT THSI AWSUM WEB SIGHT https://www.uuidgenerator.net/;
'urn:uuid:80d1a0c5-d621-40b4-94fd-21453c1d70cd';
'urn:uuid:f70c6929-68ba-4c4e-9ae9-254b9dcb609e';
'urn:uuid:d0c90575-fba9-41f1-888b-0339f0f4a498';
'urn:uuid:4b73a4f5-d717-4907-9435-3004e0a5087d';
'urn:uuid:de11e708-17d9-46ec-a58c-58cb897b8b47';
'urn:uuid:ea0f7659-4e74-4b29-9324-9d40f27ce897';
'urn:uuid:5e820a3a-6457-4550-8909-2cff51b8b1a6';
'urn:uuid:ea6ae5c8-5c01-49b9-9d59-4d74a7a15079';
*/

export const DEFAULT_MATERIALS:KeyedList<SurfaceMaterial> = {
	[noneRef]: NONE,
	[steel0Ref]: {
		title: "gray steel 0", 
		layers: [
			{
				roughness: 0.5,
				diffuse: new SurfaceColor(1.0,1.0,0.9,1.0),
			},
			{
				roughness: 1/8,
				diffuse: new SurfaceColor(1.0,1.0,0.9,0.5),
			},
		]
	},
	[steel1Ref]: {
		title: "gray steel 1",
		layers: [
			{
				roughness: 0.5,
				diffuse: new SurfaceColor(1.0,0.9,0.9,1.0),
			},
			{
				roughness: 1/8,
				diffuse: new SurfaceColor(1.0,0.9,0.9,0.5),
			},
		],
	},
	[steel2Ref]: {
		title: "black steel 0",
		layers: [
			{
				roughness: 1/8,
				diffuse: new SurfaceColor(1.0,0.8,0.7,1.0)
			},
		],
	},
	[steel3Ref]: {
		title: "black steel 1",
		layers: [
			{
				roughness: 1/8,
				diffuse: new SurfaceColor(1.0,0.7,0.8)
			}
		],
	},
	// 8-11 (reddish stone)
	[ps0Ref]: {
		title: "pink stone 0",
		layers: [
			{
				roughness: 1.0,
				diffuse: new SurfaceColor(0.70,0.30,0.2)
			},
			{
				roughness: 1/16,
				diffuse: new SurfaceColor(0.70,0.30,0.2,0.2)
			},
		],
	},
	[ps1Ref]: {
		title: "pink stone 1",
		layers: [
			{
				roughness: 1.0,
				diffuse: new SurfaceColor(0.65,0.30,0.20)
			},
			{
				roughness: 1/16,
				diffuse: new SurfaceColor(0.70,0.30,0.2,0.2)
			},
		],
	},
	[ps2Ref]: {
		title: "pink stone 2",
		layers: [ {
			roughness: 1.0,
			diffuse: new SurfaceColor(0.60,0.25,0.15)
		} ],
	},
	[ps3Ref]: {
		title: "pink stone 3",
		layers: [ {
			roughness: 1.0,
			diffuse: new SurfaceColor(0.55,0.20,0.15)
		} ],
	},
	[folg0Ref]: {
		title: "foliage 0",
		layers: [
			{
				roughness: 1.0,
				diffuse: new SurfaceColor(0.0,0.40,0.00),
				subsurfaceScattering: 0.5
			},
			{
				roughness: 0.5,
				diffuse: new SurfaceColor(0.55,1.00,0.25,0.25)
			},
		],
	},
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
	folg0Ref,
]);

export const DEFAULT_MATERIAL_MAP:MaterialMap = deepFreeze(paletteToMap(DEFAULT_MATERIAL_PALETTE, DEFAULT_MATERIALS));

export const IDENTITY_MATERIAL_REMAP:MaterialRemap = new Uint8Array(256);
for( let i=0; i<256; ++i ) IDENTITY_MATERIAL_REMAP[i] = i;
deepFreeze(IDENTITY_MATERIAL_REMAP, true);

export function paletteToMap(palette:Array<string>, materials:KeyedList<SurfaceMaterial>):Array<SurfaceMaterial> {
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
export function remap(map:Array<SurfaceMaterial>, remap:MaterialRemap, dest:Array<SurfaceMaterial>=null):Array<SurfaceMaterial> {
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
