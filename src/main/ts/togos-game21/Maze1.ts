import { deepFreeze, thaw, deepThaw, isDeepFrozen } from './DeepFreezer';
import GameDataManager from './GameDataManager';
import Datastore from './Datastore';
import HTTPHashDatastore from './HTTPHashDatastore';
import MemoryDatastore from './MemoryDatastore';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import KeyedList from './KeyedList';
import Vector3D from './Vector3D';
import { makeVector, setVector, vectorToString, ZERO_VECTOR } from './vector3ds';
import { addVector, subtractVector, vectorLength, vectorIsZero, scaleVector, normalizeVector, roundVectorToGrid } from './vector3dmath';
import AABB from './AABB';
import { makeAabb, aabbWidth, aabbHeight, aabbDepth, aabbAverageX, aabbAverageY, aabbContainsVector, aabbIntersectsWithOffset } from './aabbs';
import Quaternion from './Quaternion';
import TransformationMatrix3D from './TransformationMatrix3D';
import SceneShader, { ShadeRaster } from './SceneShader';
import { uuidUrn, newType4Uuid } from '../tshash/uuids';
import { makeTileTreeRef, makeTileEntityPaletteRef, eachSubEntity } from './worldutil';
import {
	Room,
	RoomEntity,
	RoomLocation,
	Entity,
	EntityClass,
	TileTree,
	TileEntity,
	StructureType,
	TileEntityPalette
} from './world';
import { rewriteTileTree } from './tiletrees';
import TilePaletteUI from './ui/TilePalette';

// Same format as an OSC message, minus the type header
type EntityMessageData = any[];

function entityMessageDataPath(emd:EntityMessageData):string {
	return ""+emd[0];
}

interface EntityMessage {
	sourceId : string;
	destinationId : string;
	payload : EntityMessageData;
}

function newUuidRef():string { return uuidUrn(newType4Uuid()); }

function hexDig(i:number):string {
	return String.fromCharCode( i < 10 ? 48 + i : 87 + i );
}
function hexVal(charCode:number):number {
	switch( charCode ) {
	case 0x30: return 0;
	case 0x31: return 1;
	case 0x32: return 2;
	case 0x33: return 3;
	case 0x34: return 4;
	case 0x35: return 5;
	case 0x36: return 6;
	case 0x37: return 7;
	case 0x38: return 8;
	case 0x39: return 9;
	case 0x41: case 0x61: return 10;
	case 0x42: case 0x62: return 11;
	case 0x43: case 0x63: return 12;
	case 0x44: case 0x64: return 13;
	case 0x45: case 0x65: return 14;
	case 0x46: case 0x66: return 15;
	default: throw new Error("Invalid hex digit: "+String.fromCharCode(charCode));
	}
}

function hexEncodeBits( pix:Array<number> ):string {
	let enc:string = "";
	for( let i = 0; i+4 <= pix.length; i += 4 ) {
		const num = (pix[i+0]<<3) | (pix[i+1]<<2) | (pix[i+2]<<1) | (pix[i+3]<<0);
		enc += hexDig(num); 
	}
	return enc;
}

function hexDecodeBits( enc:string ):Array<number> {
	const arr = new Array<number>(enc.length * 4);
	for( let i=0; i<enc.length; ++i ) {
		const n = hexVal(enc.charCodeAt(i));
		arr[i*4+0] = (n >> 3) & 1;
		arr[i*4+1] = (n >> 2) & 1;
		arr[i*4+2] = (n >> 1) & 1;
		arr[i*4+3] = (n >> 0) & 1;
	}
	return arr;
}

function numberToFillStyle( col:number ):string {
	return 'rgba('+
		((col>>24)&0xFF)+','+
		((col>>16)&0xFF)+','+
		((col>> 8)&0xFF)+','+
		(((col>>0)&0xFF)/255)+')';
}

function parseOneBitImageDataToDataUrl( enc:string, w:number, h:number, color0:number, color1:number ):string {
	const pixDat = hexDecodeBits(enc);
	
	const canv = document.createElement('canvas');
	canv.width = w;
	canv.height = h;
	const ctx = canv.getContext('2d');
	if( ctx == null ) throw new Error("No ctx from canvas!");
	let prevColor:number|null = null;
	for( let i=0, y=0; y < h; ++y ) {
		for( let x = 0; x < w; ++x, ++i ) {
			const col = pixDat[i] ? color1 : color0;
			if( col != prevColor ) ctx.fillStyle = numberToFillStyle(col);
			ctx.fillRect(x,y,1,1);
			prevColor = col;
		}
	}

	return canv.toDataURL();
}

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

interface BitImageInfo {
	bitstr : string;
	color0 : number;
	color1 : number;
	width : number;
	height: number;
}

const oneBitImageDataRegex = /^bitimg:([^,]+),([0-9a-f]+)$/;
function parseBitImg( m:RegExpExecArray ):BitImageInfo {
	const modStrs = m[1].split(';');
	const bitStr:string = m[2];
	const modVals:KeyedList<any> = {}; // Actually strings!  But any makes |0 happy.
	const length = bitStr.length * 4;
	const defaultWidth = Math.sqrt(length), defaultHeight = length/defaultWidth;  
	for( let i = 0; i < modStrs.length; ++i ) {
		const p = modStrs[i].split('=',2);
		if( p.length == 2 ) {
			let v:any = p[1];
			if( v[0] == '0' && v[1] == 'x' ) {
				v = parseInt(v.substr(2, 16));
			}
			modVals[p[0]] = v;
		}
	}
	return {
		bitstr: bitStr,
		color0: modVals['color0']|0,
		color1: modVals['color1']|0,
		width : modVals['width'] |0 || defaultWidth,
		height: modVals['height']|0 || defaultHeight
	}
}

// Uhm, hrm, should we use ARGB or RGBA?

function rgbaToNumber( r:number, g:number, b:number, a:number ):number {
	return ((r&0xFF)<<24) | ((g&0xFF)<<16) | ((b&0xFF)<<8) | (a&0xFF);
}

interface MazeItemVisual {
	imageRef : string;
	width : number;
	height : number;
}

interface MazeViewageItem {
	x : number;
	y : number;
	visual : MazeItemVisual;
}

interface MazeViewage {
	items : MazeViewageItem[];
	visibility? : ShadeRaster;
	opacity? : ShadeRaster; // Fer debuggin
}

const brikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(200,200,180,255)+","+hexEncodeBits(brikPix);
const bigBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(220,220,200,255)+","+hexEncodeBits(bigBrikPix);
const bigYellowBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(220,220,128,255)+","+hexEncodeBits(bigBrikPix);
const playerImgRef = "bitimg:color0=0;color1="+rgbaToNumber(224,224,96,255)+","+hexEncodeBits(playerPix);
const plant1ImgRef = "bitimg:color0=0;color1="+rgbaToNumber(64,192,64,255)+","+hexEncodeBits(plant1Pix);
const vines1ImgRef = "bitimg:color0=0;color1="+rgbaToNumber(64,192,64,255)+","+hexEncodeBits(vines1Pix);
const ballImgRef = "bitimg:color0=0;color1="+rgbaToNumber(128,48,48,255)+","+hexEncodeBits(ballPix);
const doorFrameImgRef = "bitimg:color1="+rgbaToNumber(64,64,64,255)+","+hexEncodeBits(doorFramePix);
const doorSegmentImgRef = 'bitimg:width=10;height=16;color1='+rgbaToNumber(240,240,230,255)+","+hexEncodeBits(doorSegmentPix);
const ladder1FrontImgRef = "bitimg:color1="+rgbaToNumber(128,96,96,255)+","+hexEncodeBits(ladder1FrontPix);
const ladder1SideImgRef = "bitimg:width=4;height=16;color1="+rgbaToNumber(128,96,96,255)+","+hexEncodeBits(ladder1SidePix);
const ladder1TopImgRef = "bitimg:width=16;height=4;color1="+rgbaToNumber(128,96,96,255)+","+hexEncodeBits(ladder1TopPix);

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
const room1Data = [
	1,1,1,1,1,1,0,0,1,1,0,1,1,1,1,1,
	0,0,0,0,0,1,0,1,1,0,0,0,0,0,0,0,
	1,1,0,0,0,1,0,0,0,0,0,0,0,0,0,1,
	1,1,1,0,1,1,1,1,1,1,2,0,0,2,1,1,
	1,1,1,0,1,3,8,8,8,8,0,0,0,2,1,1,
	1,1,1,0,1,1,1,2,2,2,2,2,0,2,4,1,
	1,0,0,0,0,1,1,2,5,0,0,0,0,0,4,0,
	1,0,2,2,2,1,1,2,5,1,1,1,1,3,1,0,
	1,0,2,1,1,1,1,2,5,1,0,0,1,1,1,0,
	1,0,0,0,2,2,2,2,5,1,0,0,1,1,1,1,
	0,0,5,0,0,0,0,0,5,0,0,3,1,0,0,0,
	1,1,5,1,1,1,1,1,1,1,1,1,1,0,1,1,
	1,1,5,1,1,0,0,2,2,2,2,1,0,0,0,1,
	1,0,5,0,0,0,0,0,0,1,0,0,0,0,0,1,
	1,3,5,3,1,1,0,2,2,2,0,1,0,0,0,1,
	1,1,1,1,1,1,0,0,1,1,0,1,1,1,1,1,
];
const room2Data = [
	1,2,5,0,2,1,0,0,1,1,0,1,1,1,1,1,
	0,0,5,0,0,0,0,0,9,9,0,9,1,0,1,0,
	1,0,5,0,0,1,0,0,0,0,0,0,1,0,0,0,
	1,1,1,0,1,1,1,2,7,0,0,0,1,0,0,1,
	1,1,1,0,1,1,1,2,7,0,0,0,0,0,1,1,
	1,1,1,0,8,8,4,8,7,0,0,2,2,2,1,1,
	1,0,0,0,8,8,4,8,7,0,0,0,0,0,0,0,
	1,0,2,2,2,1,4,2,7,0,0,6,1,3,3,7,
	1,0,0,0,0,1,4,2,7,0,0,6,1,1,1,7,
	1,0,0,0,0,0,4,0,0,0,0,6,1,1,1,1,
	0,0,5,0,0,0,4,0,0,0,0,6,1,0,0,0,
	1,2,5,1,1,1,1,1,1,3,3,6,1,0,1,1,
	1,2,5,1,1,0,0,2,2,2,2,1,1,0,0,1,
	1,2,5,0,0,0,0,0,0,1,0,0,0,0,0,1,
	1,2,5,0,2,1,0,2,2,2,0,1,0,0,0,1,
	1,2,5,0,2,1,0,0,1,1,0,1,1,1,1,1,
];



export class MazeView {
	public gameDataManager:GameDataManager;
	public constructor( public canvas:HTMLCanvasElement ) { }
	
	protected imageCache:KeyedList<HTMLImageElement> = {};
	public viewage : MazeViewage = { items: [] };
	public ppm = 16;

	public occlusionFillStyle:string = 'rgba(96,64,64,1)';

	protected get screenCenterX() { return this.canvas.width/2; }
	protected get screenCenterY() { return this.canvas.height/2; }
	
	protected getImage( ref:string ):HTMLImageElement {
		if( this.imageCache[ref] ) return this.imageCache[ref];

		const bitImgRee = oneBitImageDataRegex.exec(ref);
		let xRef = ref;
		if( bitImgRee ) {
			const bitImgInfo = parseBitImg(bitImgRee);
			xRef = parseOneBitImageDataToDataUrl( bitImgInfo.bitstr, bitImgInfo.width, bitImgInfo.height, bitImgInfo.color0, bitImgInfo.color1 );
		} else {
			throw new Error(ref+" not parse!");
		}

		const img = document.createElement("img");
		img.src = xRef;
		return this.imageCache[ref] = img; 
	}

	public clear():void {
		const ctx = this.canvas.getContext('2d');
		if( !ctx ) return;
		ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
	}

	protected drawRaster(rast:ShadeRaster, drawValue:number, fillStyle:string, drawMargin:boolean, borderColor?:string):void {
		const ctx = this.canvas.getContext('2d');
		if( !ctx ) return;
		const cx = this.canvas.width/2;
		const cy = this.canvas.height/2;
		const ppm = this.ppm;
		
		const canvWidth = this.canvas.width;
		const canvHeight = this.canvas.height;
		
		const vrWidth = rast.width, vrHeight = rast.height;
		const vrData = rast.data;
		ctx.fillStyle = fillStyle;

		if( borderColor ) {
			ctx.strokeStyle = borderColor;
			ctx.strokeRect(
				canvWidth /2 - rast.originX*ppm,
				canvHeight/2 - rast.originY*ppm,
				rast.width*ppm/rast.resolution,
				rast.height*ppm/rast.resolution
			)
		}

		if( drawMargin ) {
			const rastMinPx = canvWidth /2 - (rast.originX*ppm);
			const rastMinPy = canvHeight/2 - (rast.originY*ppm);
			
			const mx0 = Math.max(0, rastMinPx);
			const my0 = Math.max(0, rastMinPy);
			const mx1 = Math.min(canvWidth , rastMinPx + (rast.width /rast.resolution)*ppm);
			const my1 = Math.min(canvHeight, rastMinPy + (rast.height/rast.resolution)*ppm);
			
			ctx.fillRect(  0,   0, canvWidth    , my0           ); // Top
			ctx.fillRect(  0, my1, canvWidth    , canvHeight-my0); // Bottom
			ctx.fillRect(  0, my0, mx0          , my1-my0       ); // Left
			ctx.fillRect(mx1, my0, canvWidth-mx1, my1-my0       ); // Right
		}

		let i:number, y:number;
		const fillFog = function(x0:number, x1:number):void {
			ctx.fillRect(
				cx+ppm*(x0/rast.resolution - rast.originX),
				cy+ppm*( y/rast.resolution - rast.originY),
				ppm*(x1-x0) / rast.resolution,
				ppm         / rast.resolution
			);
		};

		for( i=0, y=0; y<vrHeight; ++y ) {
			let spanStart:number|null = null;
			for( let x=0; x<vrWidth; ++x, ++i ) {
				if( vrData[i] == drawValue ) {
					if( spanStart == null ) spanStart = x;
				} else if( spanStart != null ) {
					fillFog(spanStart, x);
					spanStart = null;
				}
			}
			if( spanStart != null ) {
				fillFog(spanStart, vrWidth);
			}
		}
	}

	protected drawOcclusionFog(viz:ShadeRaster):void {
		this.drawRaster( viz, 0, this.occlusionFillStyle, true);
	}

	public draw():void {
		const ctx = this.canvas.getContext('2d');
		if( !ctx ) return;
		const cx = this.canvas.width/2;
		const cy = this.canvas.height/2;
		const ppm = 16;
		for( let i in this.viewage.items ) {
			const item = this.viewage.items[i];
			const img = this.getImage(item.visual.imageRef);
			const px = (item.x-item.visual.width/2 ) * ppm + cx;
			const py = (item.y-item.visual.height/2) * ppm + cy;
			ctx.drawImage(img, px, py);
		}
		if(this.viewage.visibility) this.drawOcclusionFog(this.viewage.visibility);
	}
	
	public canvasPixelToWorldCoordinates(x:number, y:number, dest?:Vector3D ):Vector3D {
		const pdx = x - this.screenCenterX, pdy = y - this.screenCenterY;
		const ppm = this.ppm;
		return setVector( dest, pdx/ppm, pdy/ppm, 0 );
	}
}

const UNIT_CUBE :AABB = makeAabb(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5); 
const HUNIT_CUBE:AABB = makeAabb(-0.25, -0.25, -0.25, 0.25, 0.25, 0.25);
const QUNIT_CUBE:AABB = makeAabb(-0.125, -0.125, -0.125, 0.125, 0.125, 0.125);
const NORTH_SIDE_BB:AABB = makeAabb(-0.5,-0.5,-0.5, +0.5,+0.5,-0.25);
const EAST_SIDE_BB:AABB = makeAabb(+0.25,-0.5,-0.5, +0.5,+0.5,+0.5);
const WEST_SIDE_BB:AABB = makeAabb(-0.5,-0.5,-0.5, -0.25,+0.5,+0.5);
const TOP_SIDE_BB:AABB = makeAabb(-0.5,-0.5,-0.5, +0.5,-0.25,+0.5);

const ballEntityClassId   = 'urn:uuid:762f0209-0b91-4084-b1e0-3aac3ca5f5ab';
const doorFramePieceEntityId = 'urn:uuid:3709e285-3444-420d-9753-ef101fd7924b';
const doorSegmentEntityClassId = 'urn:uuid:5da4e293-031f-4062-b83f-83241d6768e9';
const door3EntityClassId  = 'urn:uuid:13a4aa97-7b26-49ee-b282-fc53eccdf9cb';
const tileEntityPaletteId = 'urn:uuid:50c19be4-7ab9-4dda-a52f-cf4cfe2562ac';
const playerEntityClassId = 'urn:uuid:416bfc18-7412-489f-a45e-6ff4c6a4e08b';
const brikEntityClassId = 'urn:uuid:7164c409-9d00-4d75-8fc6-4f30a5755f77';
const bigBrikEntityClassId = 'urn:uuid:de6fbe4f-a475-46fe-8613-1900d6a5d36c';
const plant1EntityClassId = 'urn:uuid:159aa4e5-016a-473d-9be7-5ba492fa899b';
const vines1EntityClassId = 'urn:uuid:4ee24c8f-7309-462e-b219-ed60505bdb52';
const backLadderEntityClassId = 'urn:uuid:80cad088-4875-4fc4-892e-34c3035035cc';
const doorFrameEntityClassId = 'urn:uuid:fde59aa4-d580-456b-b173-2b65f837fcb0';
const bigYellowBrikEntityClassId = 'urn:uuid:6764a015-767e-4403-b565-4fbe94851f0e';

const playerEntityId      = 'urn:uuid:d42a8340-ec03-482b-ae4c-a1bfdec4ba32';
const ballEntityId        = 'urn:uuid:10070a44-2a0f-41a1-bcfb-b9e16a6f1b59';
const door3EntityId       = 'urn:uuid:1a8455be-8cce-4721-8ccb-7f5644e30081';
const room1TileTreeId     = 'urn:uuid:a11ed6ae-f096-4b30-bd39-2a78d39a1385';
const room2TileTreeId     = 'urn:uuid:67228411-243c-414c-99d7-960f1151b970';

function initData( gdm:GameDataManager ):Promise<any> {
	const doorFrameBlockEntityPaletteRef = makeTileEntityPaletteRef([
		null,
		doorFramePieceEntityId,
	], gdm);
	
	const doorEntityPaletteRef = makeTileEntityPaletteRef([
		null,
		doorSegmentEntityClassId,
	], gdm);
	
	gdm.fastStoreObject<EntityClass>( {
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

	gdm.fastStoreObject<EntityClass>( {
		debugLabel: "big yellow bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox:   UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: bigYellowBrikImgRef
	}, bigYellowBrikEntityClassId );
	
	gdm.fastStoreObject<EntityClass>( {
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
		normalWalkingSpeed: 4,
		normalClimbingSpeed: 2,
		climbingSkill: 0.5,
		maxJumpImpulse: 300,
	}, playerEntityClassId );

	gdm.storeObject<EntityClass>({
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
	
	const doorSegmentBounds = makeAabb(-0.25,-0.5,-0.5, +0.25,+0.5,+0.5);
	const doorSegmentVizBounds = makeAabb(-5/16,-0.5,-0.5, +5/16,+0.5,+0.5);
	// It is a little wider visually so that it always occludes things!
	gdm.fastStoreObject<EntityClass>( {
		debugLabel: "door segment",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   doorSegmentBounds,
		physicalBoundingBox: doorSegmentBounds,
		visualBoundingBox:   doorSegmentVizBounds,
		isSolid: true,
		mass: 20,
		opacity: 1,
		visualRef: doorSegmentImgRef
	}, doorSegmentEntityClassId );
	
	const door3Bounds = makeAabb(-0.25,-1.5,-0.5, +0.25,+1.5,+0.5);
	const door3VisBounds = makeAabb(-5/16,-1.5,-0.5, +5/16,+1.5,+0.5);
	gdm.fastStoreObject<TileTree>( {
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
		mass: 60,
		normalClimbingSpeed: 4,
		climbingSkill: 15/16, // So it can climb the frames!
	}, door3EntityClassId);
	
	gdm.fastStoreObject<EntityClass>( {
		debugLabel: "bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: brikImgRef
	}, brikEntityClassId );
	
	gdm.fastStoreObject<EntityClass>( {
		debugLabel: "big bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: bigBrikImgRef
	}, bigBrikEntityClassId )
	
	gdm.fastStoreObject<EntityClass>( {
		debugLabel: "plant",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: false,
		opacity: 0.25,
		visualRef: plant1ImgRef
	}, plant1EntityClassId );
	
	gdm.fastStoreObject<TileTree>( {
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

	gdm.fastStoreObject<EntityClass>( {
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

	gdm.fastStoreObject<EntityClass>( {
		debugLabel: "vines",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: false,
		opacity: 3/4,
		visualRef: vines1ImgRef
	}, vines1EntityClassId );
	
	const regularTileEntityPaletteRef = makeTileEntityPaletteRef( [
		null,
		brikEntityClassId,
		bigBrikEntityClassId,
		plant1EntityClassId,
		/* 4: */ doorFrameEntityClassId,
		/* 5: */ backLadderEntityClassId,
		/* 6: */ gdm.fastStoreObject<EntityClass>( {
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
		/* 7: */ gdm.fastStoreObject<EntityClass>( {
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
		/* 9: */ gdm.fastStoreObject<EntityClass>( {
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
	], gdm, tileEntityPaletteId);

	// do this as second step because we need to reference that tile tree palette by ID
	const roomBounds = makeAabb(-8, -8, -0.5, 8, 8, 0.5);
	
	gdm.fastStoreObject<Room>({
		bounds: roomBounds,
		roomEntities: {
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
			[playerEntityId]: {
				position: makeVector(-4.5, -2.5, 0),
				entity: {
					id: playerEntityId,
					classRef: playerEntityClassId
				}
			}
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
				roomRef: room2Id					},
			"n": {
				offset: makeVector(0, -16, 0),
				bounds: roomBounds,
				roomRef: room1Id
			},
			"s": {
				offset: makeVector(0, +16, 0),
				bounds: roomBounds,
				roomRef: room1Id
			},
		}
	}, room1Id);

	gdm.fastStoreObject<Room>({
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
			"n": {
				offset: makeVector(0, -16, 0),
				bounds: roomBounds,
				roomRef: room2Id
			},
			"s": {
				offset: makeVector(0, +16, 0),
				bounds: roomBounds,
				roomRef: room2Id
			},
		}
	}, room2Id);
	
	return gdm.flushUpdates();
}

function roomToMazeViewage( roomRef:string, roomX:number, roomY:number, gdm:GameDataManager, viewage:MazeViewage, visibility:ShadeRaster ):void {
	const room = gdm.getRoom(roomRef);
	if( room == null ) throw new Error("Failed to load room "+roomRef);
	
	let _entityToMazeViewage = ( entity:Entity, position:Vector3D, orientation:Quaternion  ) => {}
	_entityToMazeViewage = ( entity:Entity, position:Vector3D, orientation:Quaternion ) => {
		const entityClass = gdm.getEntityClass(entity.classRef);
		if( entityClass == null ) throw new Error("Failed to load entity class "+entity.classRef);
		if( entityClass.visualRef ) {
			const minVrX = Math.max(0                , Math.floor((position.x+entityClass.visualBoundingBox.minX+visibility.originX)*visibility.resolution));
			const minVrY = Math.max(0                , Math.floor((position.y+entityClass.visualBoundingBox.minY+visibility.originY)*visibility.resolution));
			const maxVrX = Math.min(visibility.width , Math.ceil( (position.x+entityClass.visualBoundingBox.maxX+visibility.originX)*visibility.resolution));
			const maxVrY = Math.min(visibility.height, Math.ceil( (position.y+entityClass.visualBoundingBox.maxY+visibility.originY)*visibility.resolution));
			//console.log("Visibility bounds: "+minVrX+","+minVrY+" - "+maxVrX+","+maxVrY);
			let visible = false;
			isVisibleLoop: for( let vry=minVrY; vry<maxVrY; ++vry ) for( let vrx=minVrX; vrx<maxVrX; ++vrx ) {
				//console.log("Check bisibility raster@"+vrx+","+vry+"; "+(visibility.width*vry+vrx)+" = "+visibility.data[visibility.width*vry+vrx]);
				if( visibility.data[visibility.width*vry+vrx] ) {
					visible = true;
					break isVisibleLoop;
				}
			}

			// TODO: Re-use items, visuals
			if( visible ) viewage.items.push( {
				x: position.x + aabbAverageX(entityClass.visualBoundingBox),
				y: position.y + aabbAverageY(entityClass.visualBoundingBox),
				visual: {
					width: aabbWidth(entityClass.visualBoundingBox),
					height: aabbHeight(entityClass.visualBoundingBox),
					imageRef: entityClass.visualRef
				}
			})
		}
		eachSubEntity( entity, position, gdm, _entityToMazeViewage );
	};

	for( let re in room.roomEntities ) {
		const roomEntity = room.roomEntities[re];
		const orientation = roomEntity.orientation ? roomEntity.orientation : Quaternion.IDENTITY;
		_entityToMazeViewage( roomEntity.entity, makeVector(roomX+roomEntity.position.x, roomY+roomEntity.position.y, roomEntity.position.z), orientation );
	}
}
function sceneToMazeViewage( roomRef:string, roomX:number, roomY:number, gdm:GameDataManager, viewage:MazeViewage, visibility:ShadeRaster ):void {
	const room = gdm.getRoom(roomRef);
	if( room == null ) throw new Error("Failed to load room "+roomRef);
	roomToMazeViewage( roomRef, roomX, roomY, gdm, viewage, visibility );
	for( let n in room.neighbors ) {
		const neighb = room.neighbors[n];
		roomToMazeViewage( neighb.roomRef, roomX+neighb.offset.x, roomY+neighb.offset.y, gdm, viewage, visibility );
	}
}

enum XYZDirection {
	NONE = 0x00,
	POSITIVE_X = 0x1,
	NEGATIVE_X = 0x2,
	POSITIVE_Y = 0x4,
	NEGATIVE_Y = 0x8,
	POSITIVE_X_POSITIVE_Y = 0x5,
	NEGATIVE_X_NEGATIVE_Y = 0xA,
	NEGATIVE_X_POSITIVE_Y = 0x6,
	POSITIVE_X_NEGATIVE_Y = 0x9,
	// Fill these in as needed
	POSITIVE_Z = 0x10,
	NEGATIVE_Z = 0x20,
};

const xyzDirectionVectors:{[dir:number]:Vector3D} = {};
{
	// encode component
	const ec = function(i:number):number {
		return i == 0 ? 0 : i > 0 ? 1 : 2;
	}
	
	for( let z=-1; z<=1; ++z ) {
		for( let y=-1; y<=1; ++y ) {
			for( let x=-1; x<=1; ++x ) {
				const xyzDirection = (ec(x)) | (ec(y)<<2) | (ec(z)<<4);
				xyzDirectionVectors[xyzDirection] = xyzDirection == 0 ? ZERO_VECTOR : makeVector(x,y,z);
			}
		}
	}
}
const sideDirections:XYZDirection[] = [
	XYZDirection.POSITIVE_X,
	XYZDirection.POSITIVE_Y,
	XYZDirection.POSITIVE_Z,
	XYZDirection.NEGATIVE_X,
	XYZDirection.NEGATIVE_Y,
	XYZDirection.NEGATIVE_Z,
];
const ALL_SIDES = 0x3F;

interface RoomEntityUpdate {
	roomRef? : string;
	position? : Vector3D;
	velocityPosition? : Vector3D;
}

type EntityFilter = (roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass)=>boolean; 

interface FoundEntity {
	roomRef : string;
	roomEntityId : string;
	roomEntity : RoomEntity;
	
	// Individual entity that was collided-with
	entity : Entity;
	entityPosition : Vector3D;
	entityClass : EntityClass; // since we have it anyway!
}

type BounceBox = { [k:number]: FoundEntity|undefined }

const entityPositionBuffer:Vector3D = makeVector(0,0,0);
const rotate45Clockwise:TransformationMatrix3D        = deepFreeze(TransformationMatrix3D.fromXYZAxisAngle(0,0,1,+Math.PI/4));
const rotate45CounterClockwise:TransformationMatrix3D = deepFreeze(TransformationMatrix3D.fromXYZAxisAngle(0,0,1,-Math.PI/4));
const movementAttemptTransforms = [
	TransformationMatrix3D.IDENTITY,
	rotate45Clockwise,
	rotate45CounterClockwise
];

function entityVelocity( roomEntity:RoomEntity ):Vector3D {
	return roomEntity.velocity || ZERO_VECTOR;
}
function entityMass( entityClass:EntityClass ):number {
	return entityClass.mass == null ? Infinity : entityClass.mass;
}

function bounceFactor( ec0:EntityClass, ec1:EntityClass ):number {
	const bf0 = ec0.bounciness == null ? 0.5 : ec0.bounciness;
	const bf1 = ec1.bounciness == null ? 0.5 : ec1.bounciness;
	return bf0*bf1;
}

function oneify( val:number ):number {
	return val == 0 ? 0 : val > 0 ? 1 : -1;
}

function clampAbs( val:number, maxAbs:number ):number {
	if( val > maxAbs  ) return maxAbs;
	if( val < -maxAbs ) return -maxAbs;
	return val;
}

function directionate( dir:number, current:number ):number {
	if( dir > 0 && current > 0 ) return current;
	if( dir < 0 && current < 0 ) return current;
	return current;
}

function directionateVector( desired:Vector3D, current:Vector3D ):Vector3D {
	return {
		x: directionate(desired.x, current.x),
		y: directionate(desired.y, current.y),
		z: directionate(desired.z, current.z),
	}
}

/**
 * Calculate the impulse that entity A should exert onto entity B
 * in order to affect the desired change in B's relative velocity, dv.
 */
function dvImpulse(
	desiredDv:Vector3D, entityAMass:number|undefined, entityBMass:number|undefined,
	maxImpulseMagnitude:number, multiplier:number=1
):Vector3D {
	if( entityAMass == null ) entityAMass = Infinity;
	if( entityBMass == null ) entityBMass = Infinity;
	const minMass = Math.min(entityAMass, entityBMass);
	if( minMass == Infinity ) {
		// maximum impulse!
		return normalizeVector(desiredDv, maxImpulseMagnitude*multiplier);
	}
	const desiredImpulse = scaleVector(desiredDv, minMass);
	const desiredImpulseMagnitude = vectorLength(desiredImpulse);
	if( desiredImpulseMagnitude > maxImpulseMagnitude ) {
		multiplier *= maxImpulseMagnitude / desiredImpulseMagnitude;
	}
	return scaleVector(desiredImpulse, multiplier);
}

function impulseForAtLeastDesiredVelocity(
	desiredRelativeVelocity:Vector3D,
	currentRelativeVelocity:Vector3D,
	entityAMass:number|undefined, entityBMass:number|undefined,
	maxSpeed:number, maxImpulse:number,
	multiplier:number=1
):Vector3D {
	const targetRelativeVelocity = normalizeVector(desiredRelativeVelocity, maxSpeed);
	const targetDeltaVelocity = directionateVector(
		desiredRelativeVelocity,
		subtractVector(targetRelativeVelocity, currentRelativeVelocity)
	);
	return dvImpulse( targetDeltaVelocity, entityAMass, entityBMass, maxImpulse, multiplier );
}

interface Collision {
	roomEntityA : RoomEntity;
	roomEntityB : RoomEntity;
	velocity : Vector3D;
}

export class MazeGamePhysics {
	constructor( protected game:MazeGame ) { }
	
	protected pendingVelocityUpdates:KeyedList<Vector3D> = {};
	
	public induceVelocityChange( entityId:string, dv:Vector3D ):void {
		if( vectorIsZero(dv) ) return; // Save ourselves a little bit of work
		if( this.pendingVelocityUpdates[entityId] == null ) {
			this.pendingVelocityUpdates[entityId] = dv;
		} else {
			this.pendingVelocityUpdates[entityId] = addVector(this.pendingVelocityUpdates[entityId], dv);
		}
	}
	
	public registerReactionlessImpulse( entityId:string, roomEntity:RoomEntity, impulse:Vector3D ):void {
		const entityClass = this.game.gameDataManager.getEntityClass(roomEntity.entity.classRef);
		const mass = entityMass(entityClass);
		if( mass == Infinity ) return; // Nothing's going to happen
		this.induceVelocityChange(entityId, scaleVector(impulse, -1/mass));
	}
	
	public registerImpulse( entityAId:string, entityA:RoomEntity, entityBId:string, entityB:RoomEntity, impulse:Vector3D ):void {
		if( vectorIsZero(impulse) ) return; // Save ourselves a little bit of work
		
		const eAClass = this.game.gameDataManager.getEntityClass(entityA.entity.classRef);
		const eBClass = this.game.gameDataManager.getEntityClass(entityB.entity.classRef);
		
		const eAMass = entityMass(eAClass);
		const eBMass = entityMass(eBClass);
		
		if( eAMass == Infinity && eBMass == Infinity ) return; // Nothing's going to happen
		
		const eAVel = entityVelocity(entityA);
		const eBVel = entityVelocity(entityB);
		
		let systemMass:number;
		let aRat:number, bRat:number;
		//let systemVelocity:Vector3D;
		if( eAMass == Infinity ) {
			systemMass = Infinity;
			aRat = 0; bRat = 1;
			//systemVelocity = eAVel;
		} else if( eBMass == Infinity ) {
			systemMass = Infinity;
			aRat = 1; bRat = 0;
			//systemVelocity = eBVel;
		} else {
			systemMass = eAMass + eBMass;
			aRat = (systemMass-eAMass)/systemMass;
			bRat = (systemMass-eBMass)/systemMass;
			//systemVelocity = addVector(scaleVector(eAVel, eAMass/systemMass), scaleVector(eBVel, eBMass/systemMass));
		}

		const relativeDv = scaleVector(impulse, 1/eBMass + 1/eAMass);
		//const eADv = scaleVector(impulse, -1/eAMass);
		
		if( aRat != 0 ) this.induceVelocityChange(entityAId, scaleVector(relativeDv, -aRat));
		if( bRat != 0 ) this.induceVelocityChange(entityBId, scaleVector(relativeDv, +bRat));
	}
	
	protected applyVelocityChanges() {
		const game = this.game;
		const rooms = this.game.activeRooms;
		for( let r in rooms ) {
			let room = rooms[r];
			for( let re in room.roomEntities ) {
				if( this.pendingVelocityUpdates[re] ) {
					const roomEntity = room.roomEntities[re];
					const entity = roomEntity.entity;
					const entityClass = game.gameDataManager.getEntityClass(entity.classRef);
					const entityBb = entityClass.physicalBoundingBox;
					
					// Δv = impulse / m
					
					// Apparently the 1/entityClass.mass velocity vector scale doesn't quite do the job, so:
					if( entityClass.mass == Infinity ) {
						//console.log("No moving for "+re+"; it has infinite mass");
						continue;
					}

					roomEntity.velocity = addVector(
						roomEntity.velocity || ZERO_VECTOR,
						this.pendingVelocityUpdates[re]
					);
				}
			}
		}
		this.pendingVelocityUpdates = {};
	}

	protected applyCollisions() {
		for( let collEntityAId in this.collisions ) {
			for( let collEntityBId in this.collisions[collEntityAId] ) {
				const collision = this.collisions[collEntityAId][collEntityBId];
				const eAClass = this.game.gameDataManager.getEntityClass(collision.roomEntityA.entity.classRef);
				const eBClass = this.game.gameDataManager.getEntityClass(collision.roomEntityB.entity.classRef);
				// TODO: Figure out collision physics better?
				const impulse = scaleVector(collision.velocity, Math.min(entityMass(eAClass), entityMass(eBClass))*(1+bounceFactor(eAClass, eBClass)));
				this.registerImpulse( collEntityAId, collision.roomEntityA, collEntityBId, collision.roomEntityB, impulse );
			}
		}
		this.collisions = {};
	}

	protected collisions:KeyedList<KeyedList<Collision>>;
	public registerCollision( eAId:string, eA:RoomEntity, eBId:string, eB:RoomEntity, velocity:Vector3D ):void {
		if( eAId > eBId ) {
			return this.registerCollision( eBId, eB, eAId, eA, scaleVector(velocity, -1));
		}
		
		if( !this.collisions[eAId] ) this.collisions[eAId] = {};
		const already = this.collisions[eAId][eBId];
		
		if( already && vectorLength(already.velocity) > vectorLength(velocity) ) return;
		
		this.collisions[eAId][eBId] = {
			roomEntityA: eA,
			roomEntityB: eB,
			velocity: velocity
		}
	}
	
	protected borderingCuboid( roomRef:string, bb:AABB, dir:Vector3D, gridSize:number ):AABB {
		let minX = bb.minX, maxX = bb.maxX;
		let minY = bb.minY, maxY = bb.maxY;
		let minZ = bb.minZ, maxZ = bb.maxZ;
		if( dir.x < 0 ) {
			maxX = minX; minX -= gridSize; 
		} else if( dir.x > 0 ) {
			minX = maxX; maxX += gridSize;
		}
		if( dir.y < 0 ) {
			maxY = minY; minY -= gridSize; 
		} else if( dir.y > 0 ) {
			minY = maxY; maxY += gridSize;
		}
		if( dir.z < 0 ) {
			maxZ = minZ; minZ -= gridSize; 
		} else if( dir.z > 0 ) {
			minZ = maxZ; maxZ += gridSize;
		}
		return makeAabb( minX,minY,minZ, maxX,maxY,maxZ );
	}
	
	protected borderingEntities( roomRef:string, pos:Vector3D, bb:AABB, dir:Vector3D, gridSize:number, filter:EntityFilter ):FoundEntity[] {
		const border = this.borderingCuboid(roomRef, bb, dir, gridSize);
		return this.game.entitiesAt( roomRef, pos, border, filter );
	}
	
	protected massivestCollision( collisions:FoundEntity[] ):FoundEntity|undefined {
		let maxMass = 0;
		let massivest:FoundEntity|undefined = undefined;
		for( let c in collisions ) {
			const coll = collisions[c];
			const entityClass = this.game.gameDataManager.getEntityClass(coll.roomEntity.entity.classRef);
			const mass = entityMass(entityClass);
			if( mass > maxMass ) {
				maxMass = mass;
				massivest = coll;
			}
		}
		return massivest;
	}
	
	/**
	 * Finds the most massive (interactive, rigid) object in the space specified
	 */
	protected massivestBorderingEntity( roomRef:string, pos:Vector3D, bb:AABB, dir:Vector3D, gridSize:number, filter:EntityFilter ):FoundEntity|undefined {
		return this.massivestCollision( this.borderingEntities(roomRef, pos, bb, dir, gridSize, filter) );
	}
	
	protected neighboringEntities( roomRef:string, pos:Vector3D, bb:AABB, sideMask:number, gridSize:number, filter:EntityFilter ):KeyedList<FoundEntity[]> {
		const neighbors:KeyedList<FoundEntity[]> = {};
		for( let d in sideDirections ) {
			const xyzDir = sideDirections[d];
			if( ((+xyzDir)&sideMask) == 0 ) continue;
			const vec = xyzDirectionVectors[xyzDir];
			neighbors[xyzDir] = this.borderingEntities(roomRef, pos, bb, vec, gridSize, filter);
		}
		return neighbors;
	}

	/**
	 * What's around the entity?
	 */
	protected entityBounceBox( roomRef:string, pos:Vector3D, bb:AABB, sideMask:number, gridSize:number, filter:EntityFilter ):BounceBox {
		const bounceBox:BounceBox = {};
		for( let d in sideDirections ) {
			const xyzDir = sideDirections[d];
			if( ((+xyzDir)&sideMask) == 0 ) continue;
			const vec = xyzDirectionVectors[xyzDir];
			bounceBox[xyzDir] = this.massivestBorderingEntity(roomRef, pos, bb, vec, gridSize, filter);
		}
		return bounceBox;
	}
	
	public updateEntities(interval:number):void {
		const game = this.game;
		/** lesser object ID => greater object ID => force exerted from lesser to greater */
		const gravRef:string = "gravity";
		const gravDv = makeVector(0, 10*interval, 0);
		const rooms = game.activeRooms;
		const maxWalkForce = 450; // ~100 pounds of force?
		
		const snapGridSize = 1/8;
		
		// Collect impulses
		// impulses from previous step are also included.
		for( let r in rooms ) {
			let room = rooms[r];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				const entity = roomEntity.entity;
				const entityClass = game.gameDataManager.getEntityClass(entity.classRef);
				
				const otherEntityFilter:EntityFilter =
					(roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass) =>
						roomEntityId != re;
				
				const neighbEnts = this.neighboringEntities(
					r, roomEntity.position, entityClass.physicalBoundingBox, ALL_SIDES, snapGridSize, otherEntityFilter );
				
				// TODO: Just use neighbEnts rather than querying again.
				const solidOtherEntityFilter:EntityFilter =
					(roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass) =>
						roomEntityId != re && entityClass.isSolid !== false;
				
				const floorCollision = this.massivestBorderingEntity(
					r, roomEntity.position, entityClass.physicalBoundingBox,
					xyzDirectionVectors[XYZDirection.POSITIVE_Y], snapGridSize, solidOtherEntityFilter);
				
				/*
				 * Possible forces:
				 * * Gravity pulls everything down
				 * - Entities may push directly off any surfaces (jump)
				 * - Entities may push sideways against surfaces that they are pressed against (e.g. floor)
				 * - Entities may climb along ladders or other climbable things
				 */
				
				const dmd = entity.desiredMovementDirection;
				let climbing = false;
				let walking = false;
				
				if( dmd != null && entityClass.climbingSkill && (floorCollision == null || dmd.y != 0) ) {
					const minClimbability = 1 - entityClass.climbingSkill;
					let mostClimbable:FoundEntity|undefined;
					let maxClimbability = 0;
					for( let dir in neighbEnts ) {
						const neighbEnts2 = neighbEnts[dir];
						for( let e in neighbEnts2 ) {
							const climbability = neighbEnts2[e].entityClass.climbability;
							if( climbability != null && climbability >= minClimbability && climbability >= maxClimbability ) {
								// Aw yih we can climb that!
								// Theoretically we would take direction of movement into account,
								// so if you wanted to go up you'd prefer a ladder that's itself moving that way.
								mostClimbable = neighbEnts2[e];
								maxClimbability = climbability;
							}
						}
					}
					if( mostClimbable ) {
						climbing = true;
						const currentRv:Vector3D = subtractVector(entityVelocity(roomEntity), entityVelocity(mostClimbable.roomEntity));
						const maxClimbSpeed = entityClass.normalClimbingSpeed || entityClass.normalWalkingSpeed || 0;
						const climbImpulse = impulseForAtLeastDesiredVelocity(
							scaleVector(dmd, maxClimbSpeed), currentRv,
							entityClass.mass, mostClimbable.entityClass.mass,
							maxClimbSpeed, 300, -1
						);
						this.registerImpulse( re, roomEntity, mostClimbable.roomEntityId, mostClimbable.roomEntity, climbImpulse);
					}
				}
				
				// This is slightly cheating.
				// Should induce Δv due to gravity and just
				// have climb impulse take that into account.
				if( !climbing && entityClass.isAffectedByGravity && entityClass.mass != null && entityClass.mass != Infinity ) {
					this.induceVelocityChange(re, gravDv);
				}
				
				let onFloor = false;
				
				// TODO: Do this in a generic way for any 'walking' entities
				walk: if( entityVelocity(roomEntity).y >= 0 && floorCollision ) {
					onFloor = true;
					
					if( dmd == null ) break walk;
					/** Actual velocity relative to surface */
					const dvx = entityVelocity(roomEntity).x - entityVelocity(floorCollision.roomEntity).x;
					/** Desired velocity relative to surface */
					const targetDvx = (entityClass.normalWalkingSpeed || 0) * oneify(dmd.x);
					/** Desired velocity change */
					const attemptDdvx = targetDvx - dvx;
					// Attempt to change to target velocity in single tick
					const walkForce = clampAbs( -attemptDdvx*entityClass.mass/interval, maxWalkForce );
					const walkImpulse = {x:walkForce*interval, y:0, z:0};
					this.registerImpulse(
						re, roomEntity,
						floorCollision.roomEntityId, floorCollision.roomEntity,
						walkImpulse);
					
					if( dmd.y < 0 && entityClass.maxJumpImpulse ) {
						console.log(re+" jumps!");
						const jumpImpulse:Vector3D = {x:0, y:entityClass.maxJumpImpulse, z:0};
						this.registerImpulse(re, roomEntity, floorCollision.roomEntityId, floorCollision.roomEntity, jumpImpulse);
					}
				} else {
					if( dmd && dmd.y < 0 && entityClass.maxJumpImpulse ) {
						console.log(re+" can't jump; not on floor.", dmd.y);
					}
				}
				
				if( !climbing && !onFloor && dmd && entityClass.maxFlyingForce ) {
					this.registerReactionlessImpulse(re, roomEntity, scaleVector(dmd, -entityClass.maxFlyingForce*interval) );
				}
			}
		}
		
		// Apply velocity to positions,
		// do collision detection to prevent overlap and collection collisions
		this.collisions = {};
		
		for( let r in rooms ) {
			let room = rooms[r];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				const velocity:Vector3D|undefined = roomEntity.velocity;
				if( velocity == null || vectorIsZero(velocity) ) continue;
				
				const entity = roomEntity.entity;
				const entityClass = game.gameDataManager.getEntityClass(entity.classRef);
				const entityBb = entityClass.physicalBoundingBox;

				let entityRoomRef = r;
				
				let displacement = scaleVector( velocity, interval );

				const solidOtherEntityFilter:EntityFilter =
					(roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass) =>
						roomEntityId != re && entityClass.isSolid !== false;
				
				// Strategy here is:
				// figure [remaining] displacement based on velocity*interval
				// while remaining displacement > 0 {
				//   move along velocity vector as far as possible without collision
				//   based on objects in path of remaining displacement, apply impulses,
				//   calculate remaining displacement along surfaces
				// }
				
				let iter = 0;
				displacementStep: while( displacement && !vectorIsZero(displacement) ) {
					const maxDisplacementComponent =
						Math.max( Math.abs(displacement.x), Math.abs(displacement.y), Math.abs(displacement.z) );
					// How much of it can we do in a single step?
					const stepDisplacementRatio = Math.min(snapGridSize, maxDisplacementComponent) / maxDisplacementComponent;
					
					// Attempt displacing!
					const stepDeltaPos = scaleVector( displacement, stepDisplacementRatio ); 
					const newVelocityLocation = game.fixLocation({
						roomRef: entityRoomRef,
						position: addVector(
							roomEntity.velocityPosition || roomEntity.position,
							stepDeltaPos
						)
					});
					const newRoomRef = newVelocityLocation.roomRef;
					const newPosition = roundVectorToGrid(newVelocityLocation.position, snapGridSize);
					const collisions = game.entitiesAt(newVelocityLocation.roomRef, newPosition, entityBb, solidOtherEntityFilter);
					if( collisions.length == 0 ) {
						game.updateRoomEntity(entityRoomRef, re, {
							roomRef: newRoomRef,
							position: newPosition,
							velocityPosition: newVelocityLocation.position
						});
						entityRoomRef = newRoomRef;
						if( stepDisplacementRatio == 1 ) break displacementStep; // Shortcut; this should happen anyway
						// Subtract what we did and go again
						displacement = addVector(displacement, scaleVector(displacement, -stepDisplacementRatio));
						continue displacementStep;
					}

					// Uh oh, we've collided somehow.
					// Need to take that into account, zero out part or all of our displacement
					// based on where the obstacle was, register some impulses
					
					{
						// TODO: Only need bounce box for directions moving in
						const bounceBox:BounceBox = this.entityBounceBox(
							entityRoomRef, roomEntity.position, entityBb, ALL_SIDES, snapGridSize, solidOtherEntityFilter );
						
						let maxDvx = 0;
						let maxDvxColl:FoundEntity|undefined;
						let maxDvy = 0;
						let maxDvyColl:FoundEntity|undefined;
						
						let remainingDx = displacement.x;
						let remainingDy = displacement.y;

						// Is there a less repetetive way to write this?
						// Check up/down/left/right to find collisions.
						// If nothing found, then it must be a diagonal collision!
						// So then check diagonals.
						let coll:FoundEntity|undefined;
						if( displacement.x > 0 && (coll = bounceBox[XYZDirection.POSITIVE_X]) ) {
							remainingDx = 0;
							const collVel = entityVelocity(coll.roomEntity);
							const dvx = velocity.x - collVel.x;
							if( dvx > maxDvx ) {
								maxDvx = dvx;
								maxDvxColl = coll;
							}
						}
						if( displacement.x < 0 && (coll = bounceBox[XYZDirection.NEGATIVE_X]) ) {
							remainingDx = 0;
							const collVel = entityVelocity(coll.roomEntity);
							const dvx = velocity.x - collVel.x;
							if( dvx < maxDvx ) {
								maxDvx = dvx;
								maxDvxColl = coll;
							}
						}
						if( displacement.y > 0 && (coll = bounceBox[XYZDirection.POSITIVE_Y]) ) {
							remainingDy = 0;
							const collVel = entityVelocity(coll.roomEntity);
							const dvy = velocity.y - collVel.y;
							if( maxDvyColl == null || dvy > maxDvy ) {
								maxDvy = dvy;
								maxDvyColl = coll;
							}
						}
						if( displacement.y < 0 && (coll = bounceBox[XYZDirection.NEGATIVE_Y]) ) {
							remainingDy = 0;
							const collVel = entityVelocity(coll.roomEntity);
							const dvy = velocity.y - collVel.y;
							if( dvy < maxDvy ) {
								maxDvy = dvy;
								maxDvyColl = coll;
							}
						}
						
						if( maxDvxColl ) {
							this.registerCollision(
								re, roomEntity, maxDvxColl.roomEntityId, maxDvxColl.roomEntity, makeVector(maxDvx, 0, 0) 
							);
						}
						if( maxDvyColl ) {
							this.registerCollision(
								re, roomEntity, maxDvyColl.roomEntityId, maxDvyColl.roomEntity, makeVector(0, maxDvy, 0)
							);
						}
						
						// New displacement = displacement without the components that
						// would take us into obstacles:
						if( remainingDx != 0 && remainingDy != 0 ) {
							// A diagonal hit, probably.
							// Keep the larger velocity component
							if( Math.abs(remainingDx) < Math.abs(remainingDy) ) {
								remainingDx = 0;
							} else {
								remainingDy = 0;
							}
						}
						
						displacement = { x: remainingDx, y: remainingDy, z: 0 };

						++iter;
						if( iter > 2 ) {
							console.log("Too many displacement steps while moving "+re+":", roomEntity, "class:", entityClass, "iter:", iter, "velocity:", velocity, "displacement:", displacement, "bounceBox:", bounceBox, "max dvx coll:", maxDvxColl, "max dby coll:", maxDvyColl);
							break displacementStep;
						}
					}
				}
			}
		}
		
		this.applyCollisions();
		this.applyVelocityChanges();
	}
}

// TODO: Rename to MazeGameSimulator,
// move active room management to GameDataManager.
export class MazeGame {
	protected rooms:KeyedList<Room> = {};
	protected phys = new MazeGamePhysics(this);
	
	protected entityMessages:KeyedList<EntityMessage[]> = {};

	public constructor( public gameDataManager:GameDataManager ) { }
	
	public enqueueEntityMessage( em:EntityMessage ):void {
		if( !this.entityMessages[em.destinationId] ) {
			this.entityMessages[em.destinationId] = [];
		}
		this.entityMessages[em.destinationId].push(em);
	}
	
	public get activeRooms() { return this.rooms; }
	
	public getMutableRoom( roomId:string ):Room {
		if( this.rooms[roomId] ) return this.rooms[roomId];
		
		let room = this.gameDataManager.getRoom(roomId);
		
		room = thaw(room);
		room.roomEntities = thaw(room.roomEntities);
		for( let re in room.roomEntities ) {
			room.roomEntities[re] = thaw(room.roomEntities[re]);
			room.roomEntities[re].entity = thaw(room.roomEntities[re].entity);
		}
		// Apparently deepThaw doesn't quite work, yet
		this.rooms[roomId] = room; // deepThaw(room);
		return room;
	}
	
	public getRoom( roomId:string ):Room {
		if( this.rooms[roomId] ) return this.rooms[roomId];
		return this.gameDataManager.getRoom(roomId);
	}

	public fullyCacheRoom( roomId:string ):Promise<Room> {
		return this.gameDataManager.fullyCacheRoom(roomId);
	}
	
	public fullyLoadRoom( roomId:string ):Promise<Room> {
		return this.fullyCacheRoom(roomId).then( (room) => {
			return this.getMutableRoom(roomId);
		});
	}

	protected roomLoadPromises:KeyedList<Promise<Room>> = {};
	protected fullyLoadRooms2( rootRoomId:string ):Promise<Room> {
		if( this.roomLoadPromises[rootRoomId] ) return this.roomLoadPromises[rootRoomId];
		this.roomLoadPromises[rootRoomId] = this.fullyLoadRoom( rootRoomId );
		return this.roomLoadPromises[rootRoomId].then( (room) => {
			const lProms:Promise<Room>[] = [];
			for( let n in room.neighbors ) {
				const nRoomRef = room.neighbors[n].roomRef;
				if( !this.rooms[nRoomRef] && !this.roomLoadPromises[nRoomRef] ) {
					lProms.push(this.fullyLoadRooms2(nRoomRef));
				}
			}
			return Promise.all(lProms).then( () => room );
		});
	}

	public fullyLoadRooms( rootRoomId:string ):Promise<KeyedList<Room>> {
		return this.fullyLoadRooms2(rootRoomId).then( () => {
			this.roomLoadPromises = {};
			return this.rooms;
		} );
	}
	
	public fixLocation(loc:RoomLocation):RoomLocation {
		let room = this.getMutableRoom(loc.roomRef);
		if( !aabbContainsVector(room.bounds, loc.position) ) for( let n in room.neighbors ) {
			const neighb = room.neighbors[n];
			const fixedPos = subtractVector(loc.position, neighb.offset);
			if( aabbContainsVector(neighb.bounds, fixedPos) ) {
				return {
					roomRef: neighb.roomRef,
					position: fixedPos,
				};
			}
		}
		return loc;
	}

	public updateRoomEntity( roomRef:string, entityId:string, update:RoomEntityUpdate ):void {
		let room : Room = this.getMutableRoom(roomRef);
		let roomEntity = room.roomEntities[entityId];
		if( update.position ) {
			roomEntity.position = update.position;
			delete roomEntity.velocityPosition;
		}
		if( update.velocityPosition ) roomEntity.velocityPosition = update.velocityPosition;
		if( update.roomRef != null && update.roomRef != roomRef ) {
			let newRoom : Room = this.getMutableRoom(update.roomRef);
			newRoom.roomEntities[entityId] = roomEntity;
			delete room.roomEntities[entityId];
		}
	}

	protected entitiesAt3(
		roomRef:string, roomEntityId:string, roomEntity:RoomEntity, // Root roomEntity
		entityPos:Vector3D, entity:Entity, // Individual entity being checked against (may be a sub-entity of the roomEntity)
		checkPos:Vector3D, checkBb:AABB, // Sample box
		filter:EntityFilter,
		into:FoundEntity[]
	):void {
		const proto = this.gameDataManager.getEntityClass( entity.classRef );
		if( !filter(roomEntityId, roomEntity, entity, proto) ) return;
		if( !aabbIntersectsWithOffset(entityPos, proto.physicalBoundingBox, checkPos, checkBb) ) return;
		
		if( proto.structureType == StructureType.INDIVIDUAL ) {
			into.push( {
				roomRef: roomRef,
				roomEntityId: roomEntityId,
				roomEntity: roomEntity,
				entityPosition: entityPos,
				entity: entity,
				entityClass: proto,
			} );
		} else {
			eachSubEntity( entity, entityPos, this.gameDataManager, (subEnt, subEntPos, ori) => {
				this.entitiesAt3( roomRef, roomEntityId, roomEntity, subEntPos, subEnt, checkPos, checkBb, filter, into );
			}, this, entityPos);
		};
	}
	
	protected entitiesAt2( roomPos:Vector3D, roomRef:string, checkPos:Vector3D, checkBb:AABB, filter:EntityFilter, into:FoundEntity[] ):void {
		// Room bounds have presumably already been determined to intersect
		// with that of the box being checked, so we'll skip that and go
		// straight to checking entities.
		const room:Room = this.getRoom(roomRef);
		for( let re in room.roomEntities ) {
			const roomEntity = room.roomEntities[re];
			addVector( roomPos, roomEntity.position, entityPositionBuffer );
			this.entitiesAt3(roomRef, re, roomEntity, entityPositionBuffer, roomEntity.entity, checkPos, checkBb, filter, into)
		}
	}
	
	/** Overly simplistic 'is there anything at this exact point' check */
	public entitiesAt( roomRef:string, pos:Vector3D, bb:AABB, filter:EntityFilter ):FoundEntity[] {
		const collisions:FoundEntity[] = [];
		const room = this.getRoom(roomRef);
		if( aabbIntersectsWithOffset(ZERO_VECTOR, room.bounds, pos, bb) ) {
			this.entitiesAt2( ZERO_VECTOR, roomRef, pos, bb, filter, collisions );
		}
		for( let n in room.neighbors ) {
			const neighb = room.neighbors[n];
			// I used to check that bb overlapped neighb.bounds.
			// That results in missing collisions with entities whose physical bounds
			// go beyond that of the room they're in, duh.	
			this.entitiesAt2( neighb.offset, neighb.roomRef, pos, bb, filter, collisions );
		}
		return collisions;
	}
	
	protected setTileTreeBlock( roomId:string, pos:Vector3D, tileScale:number, newTile:TileEntity|number|string|null ):void {
		const room = this.getMutableRoom(roomId);
		for( let re in room.roomEntities ) {
			const roomEntity = room.roomEntities[re];
			const entityClass = this.gameDataManager.getEntityClass(roomEntity.entity.classRef);
			if( entityClass.structureType == StructureType.TILE_TREE ) {
				const posWithinTt = subtractVector(pos, roomEntity.position);
				if( aabbContainsVector(entityClass.tilingBoundingBox, posWithinTt) ) {
					roomEntity.entity.classRef = rewriteTileTree(
						roomEntity.position, roomEntity.entity.classRef,
						(ckPos:Vector3D, ckAabb:AABB, currentTileIndex:number, currentTileEntity:TileEntity|null|undefined) => {
							if( aabbContainsVector(ckAabb, pos) && aabbWidth(ckAabb) == tileScale ) {
								return newTile;
							} else {
								return currentTileIndex;
							}
						}, this.gameDataManager
					);
				}
			}
		}
	}
	
	protected processEntityMessage(
		roomId:string, room:Room, entityId:string,
		roomEntity:RoomEntity, em:EntityMessage
	):void {
		const md = em.payload;
		const path = entityMessageDataPath(md);
		if( path == "/set-tile-tree-block" ) {
			const relX = +md[1];
			const relY = +md[2];
			const relZ = +md[3];
			const tileScale = +md[4] || 1;
			const block = md[5];
			if( typeof block != 'string' && typeof block != 'number' && block !== null ) {
				console.log("Erps; bad block");
				return;
			}
			if( typeof block == 'string' ) {
				if( this.gameDataManager.getObjectIfLoaded<EntityClass>( block ) == null ) {
					console.log("Entity class "+block+" not loaded.  Try again later.");
					// Try to load it up and ignore this request for now.
					// User can click again. :P
					this.gameDataManager.fetchObject<EntityClass>( block ).then( (entiyClass) => {
						console.log("Entity class "+block+" loaded, now!  You should be able to place it, now.");
					}).catch( (err) => {
						console.error("Failed to load entity class "+block);
					});
					return;
				}
			}
			const rePos = roomEntity.position;
			const blockLoc = this.fixLocation( {roomRef: roomId, position: makeVector(relX+rePos.x, relY+rePos.y, relZ+rePos.z)} );
			this.setTileTreeBlock( blockLoc.roomRef, blockLoc.position, tileScale, block );
			return;
		}
	}
	
	public playerEntityId?:string;
	public playerDesiredMovementDirection:Vector3D = ZERO_VECTOR;
	public doorDesiredMovementDirection:Vector3D = ZERO_VECTOR;
	public update(interval:number=1/16) {
		for( let r in this.rooms ) {
			let room = this.rooms[r];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				if( re == this.playerEntityId ) {
					roomEntity.entity.desiredMovementDirection = this.playerDesiredMovementDirection;
				} else if( re == door3EntityId ) {
					roomEntity.entity.desiredMovementDirection = this.doorDesiredMovementDirection;
				}
				if( this.entityMessages[re] ) {
					const msgs = this.entityMessages[re];
					for( let m in msgs ) this.processEntityMessage( r, room, re, roomEntity, msgs[m] );
				}
			}
		}
		this.entityMessages = {};
		this.phys.updateEntities(interval);
		// For now we have to do this so that the view will see them,
		// since gdm doesn't have any way to track objects without saving them.
		// But it should eventually store our mutable rooms for us.
		this.flushUpdates();
	}
	
	public setDoorStatus(dir:number) {
		this.doorDesiredMovementDirection = makeVector(0,dir,0);
	}
	
	public flushUpdates():Promise<String> {
		for( let r in this.rooms ) {
			const room = this.rooms[r];
			if( !isDeepFrozen(room) ) {
				const urn = this.gameDataManager.fastStoreObject(room, r);
			}
		}
		return this.gameDataManager.flushUpdates();
	}

	public locateRoomEntity( id:string ):RoomLocation|undefined {
		for( let r in this.rooms ) {
			const room = this.rooms[r];
			for( let re in room.roomEntities ) {
				if( re == id ) {
					return {
						roomRef: r,
						position: room.roomEntities[re].position
					};
				}
			}
		}
		return undefined;
	}
}

function isAllZero( data:ArrayLike<number> ) {
	for( let i=0; i<data.length; ++i ) if( data[i] != 0 ) return false;
	return true;
}
function isAllNonZero( data:ArrayLike<number> ) {
	for( let i=0; i<data.length; ++i ) if( data[i] == 0 ) return false;
	return true;
}

const room1Id = 'urn:uuid:9d424151-1abf-45c1-b581-170c6eec5941';
const room2Id = 'urn:uuid:9d424151-1abf-45c1-b581-170c6eec5942';
const simulatorId = 'urn:uuid:002ae5c8-1c7f-470c-8b5d-cf79e58aa561';

enum DemoMode {
	PLAY = 0,
	EDIT = 1
}

export class MazeDemo {
	public datastore : Datastore<Uint16Array>;
	public game : MazeGame;
	public canvas:HTMLCanvasElement;
	public view : MazeView;
	public playerId : string;
	protected tickTimerId? : number;
	protected tickRate = 1/32;
	protected mode:DemoMode = DemoMode.PLAY;
	public tilePaletteUi:TilePaletteUI;
	
	public switchToNextMode() {
		this.mode++;
		if( this.mode > 1 ) {
			this.mode = 0;
		}
		if( this.mode == DemoMode.EDIT ) {
			this.tilePaletteUi.element.style.display = "";
		} else {
			this.tilePaletteUi.element.style.display = "none";
		}
	}
	
	public startSimulation() {
		if( this.tickTimerId == undefined ) {
			this.tickTimerId = setInterval(this.tick.bind(this), 1000*this.tickRate);
		}
	}
	public stopSimulation() {
		if( this.tickTimerId != undefined ) {
			clearInterval(this.tickTimerId);
			this.tickTimerId = undefined;
		}
	}
	
	protected tick() {
		this.game.update(this.tickRate);
		this.updateView();
	}

	public updateView() {
		this.maybePaint();
		this.view.viewage = { items: [] };
		
		const playerLoc = this.game.locateRoomEntity(this.playerId);

		if( playerLoc ) {
			const rasterWidth = 41;
			const rasterHeight = 31;
			const rasterResolution = 2;
			const distance = 21;
			// Line up raster origin so it falls as close as possible to the center of the raster
			// while lining up edges with world coordinates
			// TODO: shouldn't need to snap to integer world coords; raster coords would be fine.
			const rasterOriginX = Math.floor(rasterWidth /rasterResolution/2) + playerLoc.position.x - Math.floor(playerLoc.position.x);
			const rasterOriginY = Math.floor(rasterHeight/rasterResolution/2) + playerLoc.position.y - Math.floor(playerLoc.position.y);
			const visibilityRaster   = new ShadeRaster(rasterWidth, rasterHeight, rasterResolution, rasterOriginX, rasterOriginY);
			let opacityRaster:ShadeRaster|undefined;
			if( this.mode == DemoMode.EDIT ) {
				visibilityRaster.data.fill(255);
			} else {
				const distanceInPixels = rasterResolution*distance;
				opacityRaster = new ShadeRaster(rasterWidth, rasterHeight, rasterResolution, rasterOriginX, rasterOriginY);
				const sceneShader = new SceneShader(this.game.gameDataManager);
				sceneShader.sceneOpacityRaster(playerLoc.roomRef, scaleVector(playerLoc.position, -1), opacityRaster);
				if( isAllZero(opacityRaster.data) ) console.log("Opacity raster is all zero!");
				if( isAllNonZero(opacityRaster.data) ) console.log("Opacity raster is all nonzero!");
				sceneShader.opacityTolVisibilityRaster(opacityRaster, (rasterOriginX-1/4)*rasterResolution, rasterOriginY*rasterResolution, distanceInPixels, visibilityRaster);
				sceneShader.opacityTolVisibilityRaster(opacityRaster, (rasterOriginX+1/4)*rasterResolution, rasterOriginY*rasterResolution, distanceInPixels, visibilityRaster);
				if( isAllZero(visibilityRaster.data) ) console.log("Visibility raster is all zero!");
				if( isAllNonZero(visibilityRaster.data) ) console.log("Visibility raster is all nonzero!");
				sceneShader.growVisibility(visibilityRaster); // Not quite!  Since this expands visibility into non-room space.
			}
			/*
			for( let i=0, y=0; y<visibilityRaster.height; ++y ) {
				for( let x=0; x<visibilityRaster.width; ++x, ++i ) {
					if( visibilityRaster.data[i] ) {
						this.view.viewage.items.push( {
							x: x / visibilityRaster.resolution - visibilityRaster.originX,
							y: y / visibilityRaster.resolution - visibilityRaster.originY,
							visual: {
								width: 1 / visibilityRaster.resolution,
								height: 1 / visibilityRaster.resolution,
								imageRef: [plant1ImgRef,brikImgRef,bigBrikImgRef][visibilityRaster.data[i] % 3]
							}
						})
					}
				}
			}*/
			sceneToMazeViewage( playerLoc.roomRef, -playerLoc.position.x, -playerLoc.position.y, this.game.gameDataManager, this.view.viewage, visibilityRaster );
			this.view.viewage.visibility = visibilityRaster;
			this.view.viewage.opacity = opacityRaster;
		} else {
			console.log("Failed to locate player, "+this.playerId);
		}
		
		this.view.clear();
		this.view.draw();
	}
	
	protected keysDown:KeyedList<boolean> = {};
	protected keysUpdated() {
		let up=false,down=false,left=false,right=false;
		
		const rightKeys = [33,34,39,68];
		const leftKeys  = [35,36,37,65];
		const upKeys    = [33,36,38,87];
		const downKeys  = [34,35,40,83];
		
		for( let k in rightKeys ) if( this.keysDown[rightKeys[k]] ) right = true;
		for( let k in leftKeys  ) if( this.keysDown[leftKeys[k]]  ) left  = true;
		for( let k in upKeys    ) if( this.keysDown[upKeys[k]]    ) up    = true;
		for( let k in downKeys  ) if( this.keysDown[downKeys[k]]  ) down  = true;
		
		if( left && right ) left = right = false;
		if( up && down ) up = down = false;
		
		let moveX = right ? +1 : left ? -1 : 0;
		let moveY = down  ? +1 : up   ? -1 : 0;
		
		this.game.playerDesiredMovementDirection = makeVector(moveX, moveY, 0);
	}
	public keyDown(keyEvent:KeyboardEvent):void {
		if( keyEvent.keyCode == 9 ) {
			this.switchToNextMode();
			keyEvent.preventDefault();
			return;
		}
		this.keysDown[keyEvent.keyCode] = true;
		this.keysUpdated();
	}
	public keyUp(keyEvent:KeyboardEvent):void {
		delete this.keysDown[keyEvent.keyCode];
		this.keysUpdated();
	}
	public saveGame():Promise<SaveGame> {
		return this.game.gameDataManager.flushUpdates().then( (gameDataRef) => {
			const saveGame = {
				gameDataRef: gameDataRef,
				rootRoomId: room1Id,
				playerId: this.playerId
			};
			console.log("Save:",saveGame);
			return saveGame;
		});
	}
	public loadGame(save:SaveGame):Promise<MazeGame> {
		this.stopSimulation();
		const gdm = new GameDataManager(this.datastore, save.gameDataRef);
		this.view.gameDataManager = gdm;
		this.game = new MazeGame(gdm);
		console.log("Loading "+save.gameDataRef+"...");
		return this.game.fullyLoadRooms( save.rootRoomId ).then( () => {
			console.log("Loaded!");
			this.playerId = this.game.playerEntityId = save.playerId;
			this.updateView();
			this.startSimulation();
			return this.game;
		});
	}
	public inspect(ref:string):Promise<any> {
		return this.game.gameDataManager.fetchObject(ref);
	}
	public setDoorStatus(dir:number):void {
		if(this.game) this.game.setDoorStatus(dir);
	}
	
	protected eventToCanvasPixelCoordinates(evt:MouseEvent):Vector3D {
		const canv = this.canvas;
		return {
			x: evt.offsetX * (canv.width / canv.clientWidth),
			y: evt.offsetY * (canv.height / canv.clientHeight),
			z: 0
		};
	}

	public paintEntityClassRef:string|null = null;
	
	protected paintCoordinates:Vector3D|undefined;
	
	protected maybePaint() {
		if( this.mode != DemoMode.EDIT ) return;
		const coords = this.paintCoordinates;
		if( coords ) {
			this.game.enqueueEntityMessage({
				sourceId: "ui",
				destinationId: this.playerId,
				payload: ["/set-tile-tree-block", coords.x, coords.y, coords.z, 1, this.paintEntityClassRef]
			})
		};
	}
	
	public handleMouseEvent(evt:MouseEvent):void {
		if( evt.buttons == 1 ) {
			const cpCoords = this.eventToCanvasPixelCoordinates(evt);
			this.paintCoordinates = this.view.canvasPixelToWorldCoordinates(cpCoords.x, cpCoords.y);
			this.maybePaint();
		} else {
			this.paintCoordinates = undefined;
		}
	}
}

interface SaveGame {
	gameDataRef: string,
	rootRoomId: string,
	playerId: string,
}

export function startDemo(canv:HTMLCanvasElement) : MazeDemo {
	const ds = MemoryDatastore.createSha1Based(0); //HTTPHashDatastore();
	
	const v = new MazeView(canv);
	const viewItems : MazeViewageItem[] = [];

	const demo = new MazeDemo();
	demo.canvas = canv;
	demo.datastore = ds;
	demo.view = v;
	
	const tempGdm = new GameDataManager(ds);
	const gameLoaded = initData(tempGdm).then( () => tempGdm.flushUpdates() ).then( (rootNodeUri) => {
		return demo.loadGame( {
			gameDataRef: rootNodeUri,
			playerId: playerEntityId,
			rootRoomId: room1Id,
		});
	});

	canv.addEventListener('mousedown', demo.handleMouseEvent.bind(demo));
	canv.addEventListener('mouseup'  , demo.handleMouseEvent.bind(demo));
	canv.addEventListener('mousemove', demo.handleMouseEvent.bind(demo));
	
	const tpArea = document.getElementById('tile-palette-area');
	if( tpArea ) {
		const entityRenderer = (entity:Entity, orientation:Quaternion):Promise<string|null> => {
			if( entity == null ) return Promise.resolve(null);
			return demo.game.gameDataManager.fetchObject<EntityClass>( entity.classRef ).then( (entityClass) => {
				const visualRef = entityClass.visualRef;
				if( visualRef == null ) return Promise.resolve(null);
				const bitImgRee = oneBitImageDataRegex.exec(visualRef);
				let xRef = visualRef;
				if( bitImgRee ) {
					const bitImgInfo = parseBitImg(bitImgRee);
					return Promise.resolve(parseOneBitImageDataToDataUrl(
						bitImgInfo.bitstr, bitImgInfo.width, bitImgInfo.height, bitImgInfo.color0, bitImgInfo.color1 ));
				} else {
					return Promise.reject(new Error(visualRef+" not parse as bit image!"));
				}
			});
		}
		const tpUi = new TilePaletteUI( 16, entityRenderer );
		tpUi.element.style.display = 'none';
		demo.tilePaletteUi = tpUi;
		tpUi.on('select', (index:number, te:TileEntity|undefined|null) => {
			demo.paintEntityClassRef = te ? te.entity.classRef : null;
		});
		tpArea.appendChild( tpUi.element );
		gameLoaded.then( (saveGame) => {
			const initialPaletteEntityClassRefs:(string|null)[] = [
				null, brikEntityClassId, bigBrikEntityClassId,
				bigYellowBrikEntityClassId, vines1EntityClassId,
				backLadderEntityClassId, plant1EntityClassId,
				doorFrameEntityClassId,
			];
			for( let i=0; i<initialPaletteEntityClassRefs.length; ++i ) {
				tpUi.setSlot(i, initialPaletteEntityClassRefs[i]);
			}
		});
	}
	
	const openDoorButton = document.createElement('button');
	openDoorButton.appendChild(document.createTextNode("Open Door"));
	openDoorButton.onclick = () => demo.setDoorStatus(-1);
	
	const closeDoorButton = document.createElement('button');
	closeDoorButton.appendChild(document.createTextNode("Close Door"));
	closeDoorButton.onclick = () => demo.setDoorStatus(+1);
	
	const butta = document.getElementById('button-area');
	if( butta ) {
		butta.appendChild(openDoorButton);
		butta.appendChild(closeDoorButton);
	}
	
	return demo;
}
