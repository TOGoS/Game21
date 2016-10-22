import { makeVector } from './vector3ds';
import AABB from './AABB';
import { makeAabb } from './aabbs';
import {
	Room,
	EntityClass,
	AttachmentZoneClass,
	AZTYPE_HAND,
	StructureType,
	TileTree,
} from './world';
import {
	makeTileEntityPaletteRef,
	makeTileTreeRef
} from './worldutil';
import GameDataManager from './GameDataManager';
/// <reference path="../Promise.d.ts"/>

function hexDig(i:number):string {
	return String.fromCharCode( i < 10 ? 48 + i : 87 + i );
}

function hexEncodeBits( pix:Array<number> ):string {
	let enc:string = "";
	for( let i = 0; i+4 <= pix.length; i += 4 ) {
		const num = (pix[i+0]<<3) | (pix[i+1]<<2) | (pix[i+2]<<1) | (pix[i+3]<<0);
		enc += hexDig(num);
	}
	return enc;
}

function rgbaToNumber( r:number, g:number, b:number, a:number ):number {
	return ((r&0xFF)<<24) | ((g&0xFF)<<16) | ((b&0xFF)<<8) | (a&0xFF);
}

//// Images

const brikPix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
];
const bigBrikPix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
];
const playerPix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,
	0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,
	0,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,
	0,0,0,0,1,0,1,0,1,0,1,0,1,0,0,0,
	0,0,0,0,1,0,1,0,1,0,1,0,1,0,0,0,
	0,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,
	0,0,0,0,1,0,1,1,1,1,1,0,1,0,0,0,
	0,0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,
	0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,
	0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,
	0,0,1,1,1,1,0,0,0,0,0,1,1,1,1,0,
];
const plant1Pix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,
	0,0,0,0,1,0,0,1,0,0,1,0,1,1,0,0,
	0,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,
	0,0,0,0,1,1,1,1,0,0,1,0,1,0,0,0,
	0,0,1,1,0,1,0,0,1,1,1,0,0,1,0,0,
	0,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,
	0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,
	0,0,0,0,1,0,1,0,1,1,1,1,0,1,0,0,
	0,0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,
	0,0,1,1,1,1,0,1,1,0,0,0,0,0,1,0,
	0,1,0,0,0,0,1,1,1,1,1,1,0,0,0,0,
	0,0,0,0,0,0,0,1,1,0,0,0,1,0,0,0,
	0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,
];
const vines1Pix = [
	0,0,0,1,0,0,1,0,0,0,1,0,0,1,1,0,
	0,0,1,0,0,0,1,0,0,1,0,1,0,0,0,1,
	0,0,1,0,0,1,0,0,0,1,0,0,1,1,1,0,
	0,0,1,0,1,0,0,0,0,1,0,0,0,1,0,0,
	0,0,1,0,1,0,1,0,0,1,0,0,1,1,1,0,
	0,0,0,1,0,1,1,1,0,0,1,0,0,1,1,0,
	0,0,1,1,0,0,1,1,0,0,0,1,0,0,1,0,
	0,1,0,0,1,0,1,0,0,0,0,1,0,1,0,0,
	0,1,0,0,1,0,0,1,1,0,0,0,1,0,0,0,
	0,0,0,0,1,0,0,1,0,1,0,0,1,0,0,0,
	0,0,0,1,0,0,0,1,0,0,1,0,1,0,0,0,
	0,0,1,0,0,0,1,0,0,0,1,0,0,1,0,0,
	0,0,1,0,0,1,1,1,0,0,1,0,0,1,0,0,
	0,1,0,1,0,1,1,1,0,1,0,0,0,1,0,0,
	0,1,0,0,1,0,1,0,1,0,0,0,1,0,0,0,
	0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,
];
const ladder1FrontPix = [
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
];
const ladder1SidePix = [
	0,1,1,0,
	0,1,1,0,
	1,1,1,1,
	0,1,1,0,
	0,1,1,0,
	0,1,1,0,
	1,1,1,1,
	0,1,1,0,
	0,1,1,0,
	0,1,1,0,
	1,1,1,1,
	0,1,1,0,
	0,1,1,0,
	0,1,1,0,
	1,1,1,1,
	0,1,1,0,
];
const ladder1TopPix = [
	0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,
];
const doorFramePix = [
	1,1,0,1,
	1,0,1,1,
	1,1,0,1,
	1,0,0,1,
];
const doorTrackPix = [
	0,0,0,0,
	1,0,1,0,
	0,1,0,1,
	0,0,0,0,
];
const doorSegmentPix = [
	0,0,1,1,1,1,1,1,0,0,
	0,1,1,0,0,0,0,1,1,0,
	0,1,0,0,1,1,0,0,1,0,
	1,1,0,1,0,0,1,0,1,1,
	1,1,0,1,0,0,1,0,1,1,
	0,1,0,1,0,0,1,0,1,0,
	0,1,0,1,0,0,1,0,1,0,
	0,1,0,1,0,0,1,0,1,0,
	0,1,0,1,0,0,1,0,1,0,
	0,1,0,1,0,0,1,0,1,0,
	0,1,0,1,0,0,1,0,1,0,
	1,1,0,1,0,0,1,0,1,1,
	1,1,0,1,0,0,1,0,1,1,
	0,1,0,0,1,1,0,0,1,0,
	0,1,1,0,0,0,0,1,1,0,
	0,0,1,1,1,1,1,1,0,0,
];
const platformSegmentPix = [
	1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,
	1,0,0,0,0,0,0,1,
	1,1,1,1,1,1,1,1,
	1,0,0,0,0,0,0,1,
	0,1,0,0,0,0,1,0,
	0,0,1,0,0,1,0,0,
	1,1,1,1,1,1,1,1,
]
const ballPix = [
   0,0,1,1,1,1,0,0,
	0,1,1,1,1,1,1,0,
	1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,0,1,
	1,1,1,1,1,1,0,1,
	1,1,1,1,1,0,0,1,
	0,1,1,0,0,0,1,0,
	0,0,1,1,1,1,0,0,
];
const latticeColumnPix = [
	1,1,1,1,1,1,1,1,
	1,1,0,0,0,0,1,1,
	1,1,1,0,0,1,1,1,
	1,1,0,1,1,0,1,1,
	1,1,0,1,1,0,1,1,
	1,1,1,0,0,1,1,1,
	1,1,0,0,0,0,1,1,
	1,1,1,1,1,1,1,1,
];
const keyPix = [
	0,1,1,1,0,0,0,0,
	1,1,0,1,1,1,1,1,
	1,1,0,1,1,1,1,1,
	0,1,1,1,0,1,0,1,
]
const cheapDoorPix = [
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,0,1,1,0,0,1,1,0,0,
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,0,1,1,0,0,1,1,0,0,
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,0,1,1,0,0,1,1,0,0,
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,0,1,1,0,0,1,1,0,0,
	0,1,1,0,1,1,0,1,1,0,
]

function bitImgColor(c:number|number[]):number {
	if( typeof c == 'number' ) return c;
	if( c.length == 3 ) {
		return rgbaToNumber(c[0], c[1], c[2], 255);
	} else if( c.length == 4 ) {
		return rgbaToNumber(c[0], c[1], c[2], c[3]);
	}
	throw new Error("BitImg color parameter must be a number of array of length 3 or 4");
}
function bitImgRef(color0:number|number[],color1:number|number[],pixDat:number[],width:number=undefined,height:number=undefined):string {
	const mods = [];
	if( color0 != 0 ) mods.push("color0="+bitImgColor(color0));
	mods.push("color1="+bitImgColor(color1));
	if( width != undefined ) mods.push("width="+width);
	if( height != undefined ) mods.push("height="+height);
	return "bitimg:"+mods.join(';')+","+hexEncodeBits(pixDat);
}

const brikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(200,200,180,255)+","+hexEncodeBits(brikPix);
const brownBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(200,180,128,255)+","+hexEncodeBits(brikPix);
const blueBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(128,128,220,255)+","+hexEncodeBits(brikPix);
const bigBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(220,220,200,255)+","+hexEncodeBits(bigBrikPix);
const bigYellowBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(220,220,128,255)+","+hexEncodeBits(bigBrikPix);
const playerImgRef = "bitimg:color0=0;color1="+rgbaToNumber(224,224,96,255)+","+hexEncodeBits(playerPix);
const plant1ImgRef = "bitimg:color0=0;color1="+rgbaToNumber(64,192,64,255)+","+hexEncodeBits(plant1Pix);
const vines1ImgRef = "bitimg:color0=0;color1="+rgbaToNumber(64,192,64,255)+","+hexEncodeBits(vines1Pix);
const ballImgRef = "bitimg:color0=0;color1="+rgbaToNumber(128,48,48,255)+","+hexEncodeBits(ballPix);
const doorFrameImgRef = "bitimg:color1="+rgbaToNumber(64,64,64,255)+","+hexEncodeBits(doorFramePix);
const doorSegmentImgRef = 'bitimg:width=10;height=16;color1='+rgbaToNumber(240,240,230,255)+","+hexEncodeBits(doorSegmentPix);
const platformSegmentImgRef = 'bitimg:color1='+rgbaToNumber(240,240,160,255)+","+hexEncodeBits(platformSegmentPix);
const ladder1FrontImgRef = "bitimg:color1="+rgbaToNumber(128,96,96,255)+","+hexEncodeBits(ladder1FrontPix);
const ladder1SideImgRef = "bitimg:width=4;height=16;color1="+rgbaToNumber(128,96,96,255)+","+hexEncodeBits(ladder1SidePix);
const ladder1TopImgRef = "bitimg:width=16;height=4;color1="+rgbaToNumber(128,96,96,255)+","+hexEncodeBits(ladder1TopPix);
const latticeColumnImgRef = "bitimg:color1="+rgbaToNumber(192,192,192,255)+","+hexEncodeBits(latticeColumnPix);
const latticeColumnBgImgRef = "bitimg:color1="+rgbaToNumber(64,64,64,255)+","+hexEncodeBits(latticeColumnPix);

const blueKeyImgRef   = bitImgRef(0,  [0,  0,192],keyPix,8,4);
const yellowKeyImgRef = bitImgRef(0,[192,192,  0],keyPix,8,4);
const redKeyImgRef    = bitImgRef(0,[192,  0,  0],keyPix,8,4);

const cheapBlueDoorImgRef   = bitImgRef(0,[  0,  0,192],cheapDoorPix,10,16);
const cheapYellowDoorImgRef = bitImgRef(0,[192,192,  0],cheapDoorPix,10,16);
const cheapRedDoorImgRef    = bitImgRef(0,[192,  0,  0],cheapDoorPix,10,16);

//// Room data

export const room1Id = 'urn:uuid:9d424151-1abf-45c1-b581-170c6eec5941';
export const room2Id = 'urn:uuid:9d424151-1abf-45c1-b581-170c6eec5942';

const room1Data = [
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 4, 0, 0,
	1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 4, 0, 1,
	1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 2, 0, 0, 4, 0, 1,
	1, 0,16, 0, 1, 3, 8, 8, 8, 8, 0, 0, 0, 4, 0, 1,
	1, 0,16, 0, 1, 1, 1, 2, 2, 2, 2, 2, 0, 4, 0, 1,
	1, 0,16, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 4, 0, 1,
	1, 0, 2, 2, 2, 1, 1, 2, 5, 1, 1, 1, 0, 4, 0, 0,
	1, 0, 2, 1, 1, 1, 1, 2, 5, 1, 0, 2, 0, 4, 0, 0,
	1, 0, 0, 0, 2, 2, 2, 2, 5, 1, 0, 2, 0, 4, 0, 1,
	0, 0, 5, 0, 0, 0, 0, 0, 5, 0, 0, 2, 0, 4, 0, 0,
	1, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 4, 0, 1,
	1, 1, 5, 1, 1, 0, 0, 2, 2, 2, 2, 1, 0, 4, 0, 1,
	1, 0, 5, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 4, 0, 1,
	1, 3, 5, 3, 1, 1, 0, 2, 2, 2, 0, 1, 0, 4, 0, 1,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
];
const room2Data = [
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	0, 0, 5, 0, 0, 0, 0, 0, 9, 9, 0, 9, 1, 0, 1, 0,
	1, 0, 5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
	1, 1, 1, 0, 1, 1, 1, 2, 7, 0, 0, 0, 1, 0, 0, 1,
	1, 1, 1, 0, 1, 1, 1, 2, 7, 0, 0, 0, 0, 0, 1, 1,
	1, 1, 1, 0, 8, 8, 4, 8, 7, 0, 0, 2, 2, 2, 1, 1,
	1, 0, 0, 0, 8, 8, 4, 8, 7, 0, 0, 0, 0, 0, 0, 0,
	1, 0, 2, 2, 2, 1, 4, 2, 7, 0, 0, 6, 1, 3, 3, 7,
	1, 0, 0, 0, 0, 1, 4, 2, 7, 0, 0, 6, 1, 1, 1, 7,
	1, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 6, 1, 1, 1, 1,
	0, 0, 5, 0, 0, 0, 4, 0, 0, 0, 0, 6, 1, 0, 0, 0,
	1, 2, 5, 1, 1, 1, 1, 1, 1, 3, 3, 6, 1, 0, 1, 1,
	1, 2, 5, 1, 1, 0, 0, 2, 2, 2, 2, 1, 1, 0, 0, 1,
	1, 2, 5, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1,
	1, 2, 5, 0, 2, 1, 0, 2, 2, 2, 0, 1, 0, 0, 0, 1,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
];
const defaultRoomData = [
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
];

export const basicTileEntityPaletteRef = 'urn:sha1:IMPKF5EUH4AW7TCEK4LP66ZTG2DXRH3Q#';

function makeSolidArray<T>(v:T, length:number):T[] {
	let arr:T[] = [];
	for( let i=0; i<length; ++i ) arr.push(v);
	return arr;
}

export function getDefaultRoomTileTreeRef(gdm:GameDataManager, width:number, height:number, depth:number):string {
	return makeTileTreeRef(basicTileEntityPaletteRef, width, height, depth, makeSolidArray(1,width*height*depth), gdm, { infiniteMass: true });
};

//// Tile tree data

const doorFrameBlockData = [
	1,0,0,1,
	1,0,0,1,
	1,0,0,1,
	1,0,0,1,
	0,0,0,0,
	0,0,0,0,
	0,0,0,0,
	0,0,0,0,
	0,0,0,0,
	0,0,0,0,
	0,0,0,0,
	0,0,0,0,
	1,0,0,1,
	1,0,0,1,
	1,0,0,1,
	1,0,0,1,
];
const doorData = [1,1,1];

const UNIT_CUBE :AABB = makeAabb(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5); 
const HUNIT_CUBE:AABB = makeAabb(-0.25, -0.25, -0.25, 0.25, 0.25, 0.25);
const QUNIT_CUBE:AABB = makeAabb(-0.125, -0.125, -0.125, 0.125, 0.125, 0.125);
const NORTH_SIDE_BB:AABB = makeAabb(-0.5,-0.5,-0.5, +0.5,+0.5,-0.25);
const EAST_SIDE_BB:AABB = makeAabb(+0.25,-0.5,-0.5, +0.5,+0.5,+0.5);
const WEST_SIDE_BB:AABB = makeAabb(-0.5,-0.5,-0.5, -0.25,+0.5,+0.5);
const TOP_SIDE_BB:AABB = makeAabb(-0.5,-0.5,-0.5, +0.5,-0.25,+0.5);

export const ballEntityClassId   = 'urn:uuid:762f0209-0b91-4084-b1e0-3aac3ca5f5ab';
export const doorFramePieceEntityId = 'urn:uuid:3709e285-3444-420d-9753-ef101fd7924b';
export const doorSegmentEntityClassId = 'urn:uuid:5da4e293-031f-4062-b83f-83241d6768e9';
export const door3EntityClassId  = 'urn:uuid:13a4aa97-7b26-49ee-b282-fc53eccdf9cb';
export const platformSegmentEntityClassId = 'urn:uuid:819f8257-bcad-4d2f-a64e-0a855ad9dd6e';
export const platform3EntityClassId = 'urn:uuid:585927b9-b225-49d7-a49a-dff0445a1f78';
export const tileEntityPaletteId = 'urn:uuid:50c19be4-7ab9-4dda-a52f-cf4cfe2562ac';
export const playerEntityClassId = 'urn:uuid:416bfc18-7412-489f-a45e-6ff4c6a4e08b';
export const brikEntityClassId = 'urn:uuid:7164c409-9d00-4d75-8fc6-4f30a5755f77';
export const brownBrikEntityClassId = 'urn:uuid:7164c409-9d00-4d75-8fc6-4f30a5755f78';
export const blueBrikEntityClassId = 'urn:uuid:7164c409-9d00-4d75-8fc6-4f30a5755f79';
export const bigBrikEntityClassId = 'urn:uuid:de6fbe4f-a475-46fe-8613-1900d6a5d36c';
export const plant1EntityClassId = 'urn:uuid:159aa4e5-016a-473d-9be7-5ba492fa899b';
export const vines1EntityClassId = 'urn:uuid:4ee24c8f-7309-462e-b219-ed60505bdb52';
export const backLadderEntityClassId = 'urn:uuid:80cad088-4875-4fc4-892e-34c3035035cc';
export const doorFrameEntityClassId = 'urn:uuid:fde59aa4-d580-456b-b173-2b65f837fcb0';
export const bigYellowBrikEntityClassId = 'urn:uuid:6764a015-767e-4403-b565-4fbe94851f0e';

export const latticeColumnEntityClassId = 'urn:uuid:601fb61a-df00-49bf-8189-877497cf492f';
export const latticeColumnRightBlockEntityClassId = 'urn:uuid:02056297-7242-4ff2-af15-69055671e5c5';
export const latticeColumnLeftBlockEntityClassId = 'urn:uuid:9bee7432-5ad0-4f9d-9759-9d1a6fa02a85';

export const latticeColumnBgEntityClassId = 'urn:uuid:b64789e4-023c-49ea-98b5-a9d892688bbb';
export const latticeColumnBgRightBlockEntityClassId = 'urn:uuid:c447986a-19d2-447a-ab39-afe9df781dbe';
export const latticeColumnBgLeftBlockEntityClassId = 'urn:uuid:c145afdd-bc60-4c97-bad8-b6fcb3e1846f';

export const playerEntityId      = 'urn:uuid:d42a8340-ec03-482b-ae4c-a1bfdec4ba32';
export const ballEntityId        = 'urn:uuid:10070a44-2a0f-41a1-bcfb-b9e16a6f1b59';
export const blueKeyEntityId         = 'urn:uuid:fd1935da-f128-4195-8a13-90fbf59ef3bf';
export const door3EntityId       = 'urn:uuid:1a8455be-8cce-4721-8ccb-7f5644e30081';
export const platformEntityId    = 'urn:uuid:27c27635-99ba-4ef3-b3ff-445eb9b132e5';
const room1TileTreeId     = 'urn:uuid:a11ed6ae-f096-4b30-bd39-2a78d39a1385';
const room2TileTreeId     = 'urn:uuid:67228411-243c-414c-99d7-960f1151b970';

export const blueKeyEntityClassId   = 'urn:uuid:f2f4bea7-7a6a-45af-9a70-83c7ce58ba31';
export const redKeyEntityClassId    = 'urn:uuid:f2f4bea7-7a6a-45af-9a70-83c7ce58ba32';
export const yellowKeyEntityClassId = 'urn:uuid:f2f4bea7-7a6a-45af-9a70-83c7ce58ba33';

export const cheapBlueDoorEntityClassId   = 'urn:uuid:0575864a-e0d0-4fa4-b84a-a724a66dcb61';
export const cheapRedDoorEntityClassId    = 'urn:uuid:0575864a-e0d0-4fa4-b84a-a724a66dcb62';
export const cheapYellowDoorEntityClassId = 'urn:uuid:0575864a-e0d0-4fa4-b84a-a724a66dcb63';

/**
 * Returns a promise for the new game data root node URI
 */
export function initData( gdm:GameDataManager ):Promise<void> {
	const doorFrameBlockEntityPaletteRef = makeTileEntityPaletteRef([
		null,
		doorFramePieceEntityId,
	], gdm);
	
	const doorEntityPaletteRef = makeTileEntityPaletteRef([
		null,
		doorSegmentEntityClassId,
	], gdm);
	
	const platformEntityPaletteRef = makeTileEntityPaletteRef([
		null,
		platformSegmentEntityClassId,
	], gdm);
	
	gdm.tempStoreObject<EntityClass>( {
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   QUNIT_CUBE,
		physicalBoundingBox: QUNIT_CUBE,
		visualBoundingBox:   QUNIT_CUBE,
		isSolid: true,
		mass: 10,
		opacity: 1,
		climbability: 1/16,
		visualRef: doorFrameImgRef
	}, doorFramePieceEntityId );
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "big yellow bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox:   UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: bigYellowBrikImgRef
	}, bigYellowBrikEntityClassId );
	
	const leftHandAttachmentZoneKey = 'urn:uuid:aed817b0-e381-400e-9797-ce9bff56d76d';
	const rightHandAttachmentZoneKey = 'urn:uuid:8e39b8de-5f0f-4312-889b-d053bdc22649';
	const playerHandAttachmentZoneClassRef = 'urn:uuid:9ba873f6-eb7b-4f21-859f-9eba85a724c8';
	
	gdm.tempStoreObject<AttachmentZoneClass>( {
		attachmentZoneTypeRef: AZTYPE_HAND
	}, playerHandAttachmentZoneClassRef);
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "player",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: makeAabb(-0.25, -0.25, -0.25, 0.25, 0.5, 0.25),
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		isAffectedByGravity: true,
		mass: 45, // 100 lbs; he's a small guy
		bounciness: 1/64,
		visualRef: playerImgRef,
		maxFlyingForce: 100,
		maxClimbForce: 1000,
		normalWalkingSpeed: 4,
		normalClimbingSpeed: 2,
		climbingSkill: 0.5,
		maxJumpImpulse: 300,
		attachmentZoneClasseRefs: {
			[leftHandAttachmentZoneKey]: playerHandAttachmentZoneClassRef,
			[rightHandAttachmentZoneKey]: playerHandAttachmentZoneClassRef,
		},
	}, playerEntityClassId );

	gdm.tempStoreObject<EntityClass>({
		debugLabel: "bouncy ball",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: HUNIT_CUBE,
		physicalBoundingBox: HUNIT_CUBE,
		visualBoundingBox: HUNIT_CUBE,
		isSolid: true,
		isAffectedByGravity: true,
		mass: 10,
		bounciness: 1,
		opacity: 0.25,
		visualRef: ballImgRef
	}, ballEntityClassId );
	
	const platformSegmentBounds = makeAabb(-0.25,-0.25,-0.5, +0.25,+0.25,+0.5);
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "platform segment",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   platformSegmentBounds,
		physicalBoundingBox: platformSegmentBounds,
		visualBoundingBox:   platformSegmentBounds,
		isSolid: true,
		mass: 20,
		opacity: 0.5,
		visualRef: platformSegmentImgRef
	}, platformSegmentEntityClassId );
	
	const platform3Bounds = makeAabb(-1.5,-0.25,-0.5, +1.5,+0.25,+0.5);
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "1.5m-wide platform",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: platform3Bounds,
		physicalBoundingBox: platform3Bounds,
		visualBoundingBox: platform3Bounds,
		xDivisions: 6,
		yDivisions: 1,
		zDivisions: 1,
		opacity: 0.5,
		childEntityPaletteRef: platformEntityPaletteRef,
		childEntityIndexes: [1,1,1,1,1,1],
		mass: 120,
		isAffectedByGravity: true,
		normalClimbingSpeed: 4,
		climbingSkill: 15/16,
		maxClimbForce: 5000,
	}, platform3EntityClassId);
	
	const doorSegmentBounds = makeAabb(-0.25,-0.5,-0.5, +0.25,+0.5,+0.5);
	const doorSegmentVizBounds = makeAabb(-5/16,-0.5,-0.5, +5/16,+0.5,+0.5);
	// It is a little wider visually so that it always occludes things!
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "door segment",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   doorSegmentBounds,
		physicalBoundingBox: doorSegmentBounds,
		visualBoundingBox:   doorSegmentVizBounds,
		isSolid: true,
		mass: 40,
		opacity: 1,
		visualRef: doorSegmentImgRef
	}, doorSegmentEntityClassId );
	
	const door3Bounds = makeAabb(-0.25,-1.5,-0.5, +0.25,+1.5,+0.5);
	const door3VisBounds = makeAabb(-5/16,-1.5,-0.5, +5/16,+1.5,+0.5);
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "3-segment vertical door",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: door3Bounds,
		physicalBoundingBox: door3Bounds,
		visualBoundingBox: door3VisBounds,
		xDivisions: 1,
		yDivisions: 3,
		zDivisions: 1,
		opacity: 1, // should be 1; smaller for testing
		childEntityPaletteRef: doorEntityPaletteRef,
		childEntityIndexes: [1,1,1],
		mass: 120,
		isAffectedByGravity: true,
		normalClimbingSpeed: 4,
		maxClimbForce: 3000,
		climbingSkill: 15/16, // So it can climb the frames!
	}, door3EntityClassId);
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: brikImgRef
	}, brikEntityClassId );
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "brown bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: brownBrikImgRef
	}, brownBrikEntityClassId );
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "blue bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: blueBrikImgRef
	}, blueBrikEntityClassId );
	
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "big bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: bigBrikImgRef
	}, bigBrikEntityClassId )
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "plant",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: false,
		opacity: 0.25,
		visualRef: plant1ImgRef
	}, plant1EntityClassId );
	
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "door frame",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		xDivisions: 4,
		yDivisions: 4,
		zDivisions: 4,
		opacity: 0,
		childEntityPaletteRef: doorFrameBlockEntityPaletteRef,
		childEntityIndexes: doorFrameBlockData
	}, doorFrameEntityClassId );

	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "ladder (+Z)",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: NORTH_SIDE_BB,
		visualBoundingBox: UNIT_CUBE,
		opacity: 0.125,
		climbability: 0.75,
		isSolid: true,
		visualRef: ladder1FrontImgRef,
	}, backLadderEntityClassId );

	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "vines",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: false,
		opacity: 3/4,
		visualRef: vines1ImgRef
	}, vines1EntityClassId );

	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "small lattice column",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: HUNIT_CUBE,
		physicalBoundingBox: HUNIT_CUBE,
		visualBoundingBox: HUNIT_CUBE,
		isSolid: true,
		opacity: 1/4,
		climbability: 1/16,
		visualRef: latticeColumnImgRef
	}, latticeColumnEntityClassId);
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "small lattice column block (+x)",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		xDivisions: 2,
		yDivisions: 2,
		zDivisions: 2,
		childEntityPaletteRef: makeTileEntityPaletteRef([null, latticeColumnEntityClassId], gdm),
		childEntityIndexes: [0,1,0,1,0,1,0,1]
	}, latticeColumnRightBlockEntityClassId );
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "small lattice column block (-x)",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		xDivisions: 2,
		yDivisions: 2,
		zDivisions: 2,
		childEntityPaletteRef: makeTileEntityPaletteRef([null, latticeColumnEntityClassId], gdm),
		childEntityIndexes: [1,0,1,0,1,0,1,0]
	}, latticeColumnLeftBlockEntityClassId );
	
	const bgLatticeBounds = makeAabb(-0.25,-0.25,-0.125, +0.25,+0.25,+0.125);
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "small lattice column (background)",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: bgLatticeBounds,
		physicalBoundingBox: bgLatticeBounds,
		visualBoundingBox: bgLatticeBounds,
		isSolid: true,
		opacity: 1/4,
		climbability: 1/16,
		visualRef: latticeColumnBgImgRef
	}, latticeColumnBgEntityClassId);
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "small lattice column block (+x)",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		xDivisions: 2,
		yDivisions: 2,
		zDivisions: 4,
		childEntityPaletteRef: makeTileEntityPaletteRef([null, latticeColumnBgEntityClassId], gdm),
		childEntityIndexes: [0,1,0,1,0,0,0,0,0,0,0,0,0,1,0,1]
	}, latticeColumnBgRightBlockEntityClassId );
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "small lattice column block (-x)",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		xDivisions: 2,
		yDivisions: 2,
		zDivisions: 4,
		childEntityPaletteRef: makeTileEntityPaletteRef([null, latticeColumnBgEntityClassId], gdm),
		childEntityIndexes: [1,0,1,0,0,0,0,0,0,0,0,0,1,0,1,0]
	}, latticeColumnBgLeftBlockEntityClassId );
	
	const keyBoundingBox = makeAabb(-0.25,-0.125,-0.125, +0.25,+0.125,+0.125);
	const cheapDoorBoundingBox = makeAabb(-0.25,-0.5,-0.5, +0.25,+0.5,+0.5);

	const keyColors = ["blue", "yellow", "red"];
	const keyClassRefs = [blueKeyEntityClassId, yellowKeyEntityClassId, redKeyEntityClassId];
	const keyVisualRefs = [blueKeyImgRef, yellowKeyImgRef, redKeyImgRef];
	const cheapDoorClassRefs = [cheapBlueDoorEntityClassId, cheapYellowDoorEntityClassId, cheapRedDoorEntityClassId]
	const cheapDoorVisualRefs = [cheapBlueDoorImgRef, cheapYellowDoorImgRef, cheapRedDoorImgRef];
	for( let i=0; i<keyClassRefs.length; ++i ) {
		gdm.tempStoreObject<EntityClass>( {
			debugLabel: keyColors[i]+" key",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: HUNIT_CUBE,
			physicalBoundingBox: keyBoundingBox,
			visualBoundingBox: keyBoundingBox,
			isMaze1AutoPickup: true,
			isAffectedByGravity: true,
			isSolid: true,
			mass: 0.25, // It's a big key
			visualRef: keyVisualRefs[i],
		}, keyClassRefs[i])
		gdm.tempStoreObject<EntityClass>( {
			debugLabel: "cheap "+keyColors[i]+"-lock door",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: HUNIT_CUBE,
			physicalBoundingBox: doorSegmentBounds,
			visualBoundingBox: doorSegmentVizBounds,
			visualRef: cheapDoorVisualRefs[i],
			opacity: 0.5,
		}, cheapDoorClassRefs[i]);
	}
	
	const regularTileEntityPaletteRef = makeTileEntityPaletteRef( [
		null,
		brikEntityClassId,
		bigBrikEntityClassId,
		plant1EntityClassId,
		/* 4: */ doorFrameEntityClassId,
		/* 5: */ backLadderEntityClassId,
		/* 6: */ gdm.tempStoreObject<EntityClass>( {
			debugLabel: "ladder (+X)",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: UNIT_CUBE,
			physicalBoundingBox: EAST_SIDE_BB,
			visualBoundingBox: EAST_SIDE_BB,
			opacity: 0.125,
			climbability: 0.75,
			isSolid: true,
			visualRef: ladder1SideImgRef,
		}),
		/* 7: */ gdm.tempStoreObject<EntityClass>( {
			debugLabel: "ladder (-X)",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: UNIT_CUBE,
			physicalBoundingBox: WEST_SIDE_BB,
			visualBoundingBox: WEST_SIDE_BB,
			opacity: 0.125,
			climbability: 0.75,
			isSolid: true,
			visualRef: ladder1SideImgRef,
		}),
		/* 8 */ vines1EntityClassId,
		/* 9: */ gdm.tempStoreObject<EntityClass>( {
			debugLabel: "ladder (-Y)",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: UNIT_CUBE,
			physicalBoundingBox: TOP_SIDE_BB,
			visualBoundingBox: TOP_SIDE_BB,
			opacity: 0.125,
			climbability: 0.75,
			isSolid: true,
			visualRef: ladder1TopImgRef,
		}),
		/* 10 */ latticeColumnRightBlockEntityClassId,
		/* 11 */ latticeColumnLeftBlockEntityClassId,
		/* 12 */ latticeColumnBgRightBlockEntityClassId,
		/* 13 */ latticeColumnBgLeftBlockEntityClassId,
		/* 14 */ brownBrikEntityClassId,
		/* 15 */ blueBrikEntityClassId,
		/* 16 */ cheapBlueDoorEntityClassId,
		/* 17 */ cheapYellowDoorEntityClassId,
		/* 18 */ cheapRedDoorEntityClassId,
	], gdm, tileEntityPaletteId);

	// do this as second step because we need to reference that tile tree palette by ID
	const roomBounds = makeAabb(-8, -8, -0.5, 8, 8, 0.5);
	
	gdm.tempStoreObject<Room>({
		bounds: roomBounds,
		roomEntities: {
			[playerEntityId]: {
				position: makeVector(-4.5, -2.5, 0),
				entity: {
					id: playerEntityId,
					classRef: playerEntityClassId,
					desiresMaze1AutoPickups: true,
				},
			},
			[blueKeyEntityId]: {
				position: makeVector(-3.5, -1.5, 0),
				entity: {
					classRef: blueKeyEntityClassId
				}
			},
			[room1TileTreeId]: {
				position: makeVector(0,0,0),
				entity: {
					classRef: makeTileTreeRef( regularTileEntityPaletteRef, 16, 16, 1, room1Data, gdm, { infiniteMass: true } )
				}
			},
			[ballEntityId]: {
				position: makeVector(-2.5, -3.5, 0),
				entity: {
					classRef: ballEntityClassId
				}
			},
			[platformEntityId]: {
				position: makeVector(5.5, 0, 0),
				entity: {
					classRef: platform3EntityClassId,
					desiredMovementDirection: makeVector(0, -1.0, 0),
				}
			},
		},
		neighbors: {
			"w": {
				offset: makeVector(-16, 0, 0),
				bounds: roomBounds,
				roomRef: room2Id
			},
			"e": {
				offset: makeVector(+16, 0, 0),
				bounds: roomBounds,
				roomRef: room2Id					
			},
		}
	}, room1Id);

	gdm.tempStoreObject<Room>({
		bounds: roomBounds,
		roomEntities: {
			[room2TileTreeId]: {
				position: makeVector(0,0,0),
				entity: {
					classRef: makeTileTreeRef( regularTileEntityPaletteRef, 16, 16, 1, room2Data, gdm, { infiniteMass: true } )
				}
			},
			[door3EntityId]: {
				position: makeVector(-1.5,+1.5,0),
				entity: {
					classRef: door3EntityClassId
				}
			},
		},
		neighbors: {
			"w": {
				offset: makeVector(-16, 0, 0),
				bounds: roomBounds,
				roomRef: room1Id
			},
			"e": {
				offset: makeVector(+16, 0, 0),
				bounds: roomBounds,
				roomRef: room1Id
			},
		}
	}, room2Id);
	
	return Promise.resolve();
}

import { sha1Urn } from '../tshash/index';
import Datastore from './Datastore';
import HTTPHashDatastore from './HTTPHashDatastore';

if( typeof require != 'undefined' && typeof module != 'undefined' && require.main === module ) {
	const dataIdent = sha1Urn;
	const ds:Datastore<Uint8Array> = HTTPHashDatastore.createDefault();
	const gdm:GameDataManager = new GameDataManager(ds);
	initData(gdm).then( (rootNodeUri) => {
		const saveGame = {
			gameDataRef: rootNodeUri,
			rootRoomId: room1Id,
			playerId: playerEntityId
		};
		return gdm.storeObject(saveGame).then( (saveRef) => {
			console.log(saveRef);
		});
	}).catch( (err) => {
		console.error("Error generating initial savegame", err)
	});
}
