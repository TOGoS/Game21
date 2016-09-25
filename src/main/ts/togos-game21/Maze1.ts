import { deepFreeze, thaw, deepThaw, isDeepFrozen } from './DeepFreezer';
import GameDataManager from './GameDataManager';
import Datastore from './Datastore';
import HTTPHashDatastore from './HTTPHashDatastore';
import MemoryDatastore from './MemoryDatastore';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import KeyedList from './KeyedList';
import Vector3D from './Vector3D';
import AABB from './AABB';
import { makeAabb, aabbWidth, aabbHeight, aabbDepth, aabbContainsVector, aabbIntersectsWithOffset } from './aabbs';
import { makeVector, vectorToString, ZERO_VECTOR } from './vector3ds';
import { addVector, subtractVector, vectorLength, vectorIsZero, scaleVector, normalizeVector, roundVectorToGrid } from './vector3dmath';
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
	StructureType,
	TileEntityPalette
} from './world';

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
const ladder1Pix = [
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
			let v = p[1];
			if( v[0] == '0' && v[1] == 'x' ) {
				throw new Error("Don't handle 0x... colors et");
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

const brikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(255,255,128,255)+","+hexEncodeBits(brikPix);
const bigBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(255,255,128,255)+","+hexEncodeBits(bigBrikPix);
const playerImgRef = "bitimg:color0=0;color1="+rgbaToNumber(255,255,96,255)+","+hexEncodeBits(playerPix);
const plant1ImgRef = "bitimg:color0=0;color1="+rgbaToNumber(64,255,64,255)+","+hexEncodeBits(plant1Pix);
const ballImgRef = "bitimg:color0=0;color1="+rgbaToNumber(128,48,48,255)+","+hexEncodeBits(ballPix);
const doorFrameImgRef = "bitimg:color1="+rgbaToNumber(64,64,64,255)+","+hexEncodeBits(doorFramePix);

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
const room1Data = [
	1,1,1,1,1,1,0,0,1,1,0,1,1,1,1,1,
	0,0,0,0,0,1,0,1,1,0,0,0,0,0,0,0,
	1,1,0,0,0,1,0,0,0,0,0,0,0,0,0,1,
	1,1,1,0,1,1,1,1,1,1,2,0,2,0,1,1,
	1,1,1,0,1,1,1,1,0,0,0,0,0,0,1,1,
	1,1,1,0,1,1,1,2,2,2,2,0,0,0,4,1,
	1,0,0,0,0,1,1,2,0,0,0,0,0,0,4,0,
	1,0,2,2,2,1,1,2,0,1,1,1,1,3,1,0,
	1,0,2,1,1,1,1,2,0,1,0,0,1,1,1,0,
	1,0,0,0,2,2,2,2,0,1,0,0,1,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,3,1,0,0,0,
	1,1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,
	1,1,0,1,1,0,0,2,2,2,2,1,0,0,0,1,
	1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,
	1,3,3,3,1,1,0,2,2,2,0,1,0,0,0,1,
	1,1,1,1,1,1,0,0,1,1,0,1,1,1,1,1,
];
const room2Data = [
	1,2,0,0,2,1,0,0,1,1,0,1,1,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,
	1,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,
	1,1,1,0,1,1,1,2,0,0,0,0,1,0,0,1,
	1,1,1,0,1,1,1,2,0,0,0,0,0,0,1,1,
	1,1,1,0,1,1,4,2,0,0,0,2,2,2,1,1,
	1,0,0,0,0,1,4,2,0,0,0,0,0,0,0,0,
	1,0,2,2,2,1,4,2,0,0,0,0,1,3,1,0,
	1,0,0,0,0,1,4,2,0,0,0,0,1,1,1,0,
	1,0,0,0,0,0,4,0,0,0,0,0,1,1,1,1,
	0,0,0,0,0,0,4,0,0,0,0,3,1,0,0,0,
	1,2,0,1,1,1,1,1,1,3,3,3,1,0,1,1,
	1,2,0,1,1,0,0,2,2,2,2,1,1,0,0,1,
	1,2,0,0,0,0,0,0,0,1,0,0,0,0,0,1,
	1,2,0,0,2,1,0,2,2,2,0,1,0,0,0,1,
	1,2,0,0,2,1,0,0,1,1,0,1,1,1,1,1,
];



export class MazeView {
	public gameDataManager:GameDataManager;
	public constructor( public canvas:HTMLCanvasElement ) { }
	
	protected imageCache:KeyedList<HTMLImageElement> = {};
	public viewage : MazeViewage = { items: [] };

	public occlusionFillStyle:string = 'rgba(96,64,64,1)';

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
		const ppm = 16;

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
			const rastMinPx = Math.max(0, canvWidth /2 - (rast.originX*ppm));
			const rastMinPy = Math.max(0, canvHeight/2 - (rast.originY*ppm));
			const rastMaxPx = Math.min(canvWidth , rastMinPx + (rast.width /rast.resolution)*ppm);
			const rastMaxPy = Math.min(canvHeight, rastMinPy + (rast.height/rast.resolution)*ppm);

			ctx.fillRect(0,       0,canvWidth,rastMinPy           );
			ctx.fillRect(0,rastMaxPy,canvWidth,canvHeight-rastMinPy);
			ctx.fillRect(0       ,rastMinPy,rastMinPx          ,rastMaxPy-rastMinPy);
			ctx.fillRect(rastMaxPx,rastMinPy,canvWidth-rastMaxPx,rastMaxPy-rastMinPy);
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
}

const UNIT_CUBE :AABB = makeAabb(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5); 
const HUNIT_CUBE:AABB = makeAabb(-0.25, -0.25, -0.25, 0.25, 0.25, 0.25);
const QUNIT_CUBE:AABB = makeAabb(-0.125, -0.125, -0.125, 0.125, 0.125, 0.125);

const ballEntityClassId   = 'urn:uuid:762f0209-0b91-4084-b1e0-3aac3ca5f5ab';
const doorFramePieceEntityId   = 'urn:uuid:3709e285-3444-420d-9753-ef101fd7924b';
const tileEntityPaletteId = 'urn:uuid:50c19be4-7ab9-4dda-a52f-cf4cfe2562ac';
const playerEntityClassId = 'urn:uuid:416bfc18-7412-489f-a45e-6ff4c6a4e08b';
const playerEntityId      = 'urn:uuid:d42a8340-ec03-482b-ae4c-a1bfdec4ba32';
const ballEntityId        = 'urn:uuid:10070a44-2a0f-41a1-bcfb-b9e16a6f1b590';
const room1TileTreeId     = 'urn:uuid:a11ed6ae-f096-4b30-bd39-2a78d39a1385';
const room2TileTreeId     = 'urn:uuid:67228411-243c-414c-99d7-960f1151b970';

function initData( gdm:GameDataManager ):Promise<any> {
	const doorFrameBlockEntityPaletteRef = makeTileEntityPaletteRef([
		null,
		doorFramePieceEntityId
	], gdm);
	gdm.fastStoreObject<EntityClass>( {
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   QUNIT_CUBE,
		physicalBoundingBox: QUNIT_CUBE,
		visualBoundingBox:   QUNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: doorFrameImgRef
	}, doorFramePieceEntityId );

	gdm.fastStoreObject<EntityClass>( {
		debugLabel: "player",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: makeAabb(-0.25, -0.25, -0.25, 0.25, 0.5, 0.25),
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		isAffectedByGravity: true,
		mass: 45, // 100 lbs; he's a small guy
		bounciness: 0.5,
		visualRef: playerImgRef,
		normalWalkingSpeed: 4,
		normalClimbingSpeed: 2,
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

	const regularTileEntityPaletteRef = makeTileEntityPaletteRef( [
		null,
		gdm.fastStoreObject<EntityClass>( {
			debugLabel: "bricks",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: UNIT_CUBE,
			physicalBoundingBox: UNIT_CUBE,
			visualBoundingBox: UNIT_CUBE,
			isSolid: true,
			opacity: 1,
			visualRef: brikImgRef
		} ),
		gdm.fastStoreObject<EntityClass>( {
			debugLabel: "big bricks",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: UNIT_CUBE,
			physicalBoundingBox: UNIT_CUBE,
			visualBoundingBox: UNIT_CUBE,
			isSolid: true,
			opacity: 1,
			visualRef: bigBrikImgRef
		} ),
		gdm.fastStoreObject<EntityClass>( {
			debugLabel: "plant",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: UNIT_CUBE,
			physicalBoundingBox: UNIT_CUBE,
			visualBoundingBox: UNIT_CUBE,
			isSolid: false,
			opacity: 0.25,
			visualRef: plant1ImgRef
		} ),
		gdm.fastStoreObject<TileTree>( {
			debugLabel: "Door frame",
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
		})
	], gdm);

	return gdm.updateMap({[tileEntityPaletteId]: regularTileEntityPaletteRef}).then( () => {
		console.log("Fetching "+tileEntityPaletteId+"...");
		return gdm.fetchObject(tileEntityPaletteId).then( (pal) => {
			console.log("Okay, loaded tile entity palette "+tileEntityPaletteId+"!");
		}).catch( (err) => {
			return Promise.reject(new Error("Hmm.  Tile entity palette "+tileEntityPaletteId+" not stored somehow."));
		})
	}).then( () => {
		// do this as second step because we need to reference that tile tree palette by ID
		const roomBounds = makeAabb(-8, -8, -0.5, 8, 8, 0.5);
		return Promise.all([
			gdm.storeObject<Room>({
				bounds: roomBounds,
				roomEntities: {
					[room1TileTreeId]: {
						position: makeVector(0,0,0),
						entity: {
							classRef: makeTileTreeRef( regularTileEntityPaletteRef, 16, 16, 1, room1Data, gdm, { infiniteMass: true } )
						}
					},
					[ballEntityId]: {
						position: makeVector(-4.5, -1.5, 0),
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
			}, room1Id),

			gdm.storeObject<Room>({
				bounds: roomBounds,
				roomEntities: {
					[room2TileTreeId]: {
						position: makeVector(0,0,0),
						entity: {
							classRef: makeTileTreeRef( regularTileEntityPaletteRef, 16, 16, 1, room2Data, gdm, { infiniteMass: true } )
						}
					}
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
			}, room2Id)
		])
	});
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
				x: position.x,
				y: position.y,
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
console.log("direction vectors:", xyzDirectionVectors);

interface RoomEntityUpdate {
	roomRef? : string;
	position? : Vector3D;
	velocityPosition? : Vector3D;
}

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

interface Collision {
	roomEntityA : RoomEntity;
	roomEntityB : RoomEntity;
	velocity : Vector3D;
}

let updatePhase:string = 'unstarted';

export class MazeGamePhysics {
	constructor( protected game:MazeGame ) { }
	
	protected inducedVelocityChanges:KeyedList<Vector3D> = {};
	
	public induceVelocityChange( entityId:string, dv:Vector3D ):void {
		if( vectorIsZero(dv) ) return; // Save ourselves a little bit of work
		if( this.inducedVelocityChanges[entityId] == null ) {
			this.inducedVelocityChanges[entityId] = dv;
		} else {
			this.inducedVelocityChanges[entityId] = addVector(this.inducedVelocityChanges[entityId], dv);
		}
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
		
		if( aRat != 0 ) this.induceVelocityChange(entityAId, scaleVector(impulse, -aRat/eAMass));
		if( bRat != 0 ) this.induceVelocityChange(entityBId, scaleVector(impulse, +bRat/eBMass));
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
	
	protected borderingCollisions( roomRef:string, pos:Vector3D, bb:AABB, dir:Vector3D, gridSize:number, ignoreEntityId:string ):FoundEntity[] {
		const border = this.borderingCuboid(roomRef, bb, dir, gridSize);
		return this.game.solidEntitiesAt( roomRef, pos, border, ignoreEntityId );
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
	protected massivestBorderingCollision( roomRef:string, pos:Vector3D, bb:AABB, dir:Vector3D, gridSize:number, ignoreEntityId:string ):FoundEntity|undefined {
		return this.massivestCollision( this.borderingCollisions(roomRef, pos, bb, dir, gridSize, ignoreEntityId) );
	}
	
	/**
	 * What's around the entity?
	 */
	protected entityBounceBox( roomRef:string, pos:Vector3D, bb:AABB, gridSize:number, ignoreEntityId:string ):BounceBox {
		const bounceBox:BounceBox = {};
		for( let xyzDir in xyzDirectionVectors ) {
			if( xyzDir == '0' ) continue;
			const vec = xyzDirectionVectors[xyzDir];
			bounceBox[xyzDir] = this.massivestBorderingCollision(roomRef, pos, bb, vec, gridSize, ignoreEntityId);
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
		const maxJumpImpulse = 300;
		
		const snapGridSize = 1/8;
		
		// Collect impulses
		// impulses from previous step are also included.
		updatePhase = 'auto-impulse-collection';
		for( let r in rooms ) {
			let room = rooms[r];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				const entity = roomEntity.entity;
				const entityClass = game.gameDataManager.getEntityClass(entity.classRef);
				
				const entityBb = entityClass.physicalBoundingBox;
				if( entityClass.isAffectedByGravity && entityClass.mass != null && entityClass.mass != Infinity ) {
					this.induceVelocityChange(re, gravDv);
				}
				
				const floorCollision = this.massivestBorderingCollision(
					r, roomEntity.position, entityClass.physicalBoundingBox,
					xyzDirectionVectors[XYZDirection.POSITIVE_Y], snapGridSize, re);
				
				/*
				 * Possible forces:
				 * * Gravity pulls everything down
				 * - Entities may push directly off any surfaces (jump)
				 * - Entities may push sideways against surfaces that they are pressed against (e.g. floor)
				 * - Entities may climb along ladders or other climbable things
				 */
				
				// TODO: Do this in a generic way for any 'walking' entities
				if( entityVelocity(roomEntity).y >= 0 && floorCollision && entity.desiredMovementDirection != null ) {
					const dmd = entity.desiredMovementDirection;
					
					/** Actual velocity relative to surface */
					const dvx = entityVelocity(roomEntity).x - entityVelocity(floorCollision.roomEntity).x;
					const dmx = dmd.x;
					/** Desired velocity relative to surface */
					const targetDvx = (entityClass.normalWalkingSpeed || 0) * oneify(dmx);
					/** Desired velocity change */
					const attemptDdvx = targetDvx - dvx;
					// Attempt to change to target velocity in single tick
					const walkForce = clampAbs( -attemptDdvx*entityClass.mass/interval, maxWalkForce );
					const walkImpulse = {x:walkForce*interval, y:0, z:0};
					this.registerImpulse(
						re, roomEntity,
						floorCollision.roomEntityId, floorCollision.roomEntity,
						walkImpulse);
					
					if( dmd.y < 0 ) {
						//console.log(re+" jumps!");
						const jumpImpulse:Vector3D = {x:0, y:maxJumpImpulse, z:0};
						this.registerImpulse(re, roomEntity, floorCollision.roomEntityId, floorCollision.roomEntity, jumpImpulse);
					}
				} else {
					// Drag!
					//roomEntity.velocity = scaleVector(roomEntity.velocity || ZERO_VECTOR, Math.pow(0.9, interval));
				}
			}
		}
		
		updatePhase = 'impulse-application';
		// Apply impulses
		for( let r in rooms ) {
			let room = rooms[r];
			for( let re in room.roomEntities ) {
				if( this.inducedVelocityChanges[re] ) {
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
						this.inducedVelocityChanges[re]
					);
				}
			}
		}
		
		// They've been applied!
		this.inducedVelocityChanges = {};
		
		// Apply velocity to positions,
		// do collision detection to prevent overlap and collection collisions
		this.collisions = {};
		
		for( let r in rooms ) {
			let room = rooms[r];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				const velocity:Vector3D|undefined = roomEntity.velocity;
				if( velocity == null || vectorIsZero(velocity) ) continue;
				
				updatePhase = 'displacement';
				
				const entity = roomEntity.entity;
				const entityClass = game.gameDataManager.getEntityClass(entity.classRef);
				const entityBb = entityClass.physicalBoundingBox;

				let entityRoomRef = r;
				
				let displacement = scaleVector( velocity, interval );
				
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
					const collisions = game.solidEntitiesAt(newVelocityLocation.roomRef, newPosition, entityBb, re);
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
					
					updatePhase = 'bounce';
					
					// Uh oh, we've collided somehow.
					// Need to take that into account, zero out part or all of our displacement
					// based on where the obstacle was, register some impulses
					
					{
						// TODO: Only need bounce box for directions moving in
						const bounceBox:BounceBox = this.entityBounceBox(
							entityRoomRef, roomEntity.position, entityBb, snapGridSize, re );
						
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
		
		for( let collEntityAId in this.collisions ) {
			for( let collEntityBId in this.collisions[collEntityAId] ) {
				const collision = this.collisions[collEntityAId][collEntityBId];
				const eAClass = this.game.gameDataManager.getEntityClass(collision.roomEntityA.entity.classRef);
				const eBClass = this.game.gameDataManager.getEntityClass(collision.roomEntityB.entity.classRef);
				// TODO: Figure out collision physics better.
				const impulse = scaleVector(collision.velocity, Math.min(entityMass(eAClass), entityMass(eBClass))*(1+bounceFactor(eAClass, eBClass)));
				this.registerImpulse( collEntityAId, collision.roomEntityA, collEntityBId, collision.roomEntityB, impulse );
			}
		}
		
		this.collisions = {};
	}
}

export class MazeGame {
	protected rooms:KeyedList<Room> = {};
	protected phys = new MazeGamePhysics(this);

	public constructor( public gameDataManager:GameDataManager ) { }
	
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

	protected solidEntitiesAt3(
		roomRef:string, roomEntityId:string, roomEntity:RoomEntity, // Root roomEntity
		entityPos:Vector3D, entity:Entity, // Individual entity being checked against (may be a sub-entity of the roomEntity)
		checkPos:Vector3D, checkBb:AABB, // Sample box
		into:FoundEntity[]
	):void {
		const proto = this.gameDataManager.getEntityClass( entity.classRef );
		if( proto.isSolid === false ) return;
		if( !aabbIntersectsWithOffset(entityPos, proto.physicalBoundingBox, checkPos, checkBb) ) return;
		
		if( proto.structureType == StructureType.INDIVIDUAL ) {
			if( proto.isSolid ) {
				into.push( {
					roomRef: roomRef,
					roomEntityId: roomEntityId,
					roomEntity: roomEntity,
					entityPosition: entityPos,
					entity: entity,
					entityClass: proto,
				} );
			}
		} else {
			eachSubEntity( entity, entityPos, this.gameDataManager, (subEnt, subEntPos, ori) => {
				this.solidEntitiesAt3( roomRef, roomEntityId, roomEntity, subEntPos, subEnt, checkPos, checkBb, into );
			}, this, entityPos);
		};
	}
	
	protected solidEntitiesAt2( roomPos:Vector3D, roomRef:string, checkPos:Vector3D, checkBb:AABB, ignoreEntityId:string|undefined=undefined, into:FoundEntity[] ):void {
		// Room bounds have presumably already been determined to intersect
		// with that of the box being checked, so we'll skip that and go
		// straight to checking entities.
		const room:Room = this.getRoom(roomRef);
		for( let re in room.roomEntities ) {
			if( re == ignoreEntityId ) continue;
			const roomEntity = room.roomEntities[re];
			addVector( roomPos, roomEntity.position, entityPositionBuffer );
			this.solidEntitiesAt3(roomRef, re, roomEntity, entityPositionBuffer, roomEntity.entity, checkPos, checkBb, into)
		}
	}
	
	/** Overly simplistic 'is there anything at this exact point' check */
	public solidEntitiesAt( roomRef:string, pos:Vector3D, bb:AABB, ignoreEntityId?:string ):FoundEntity[] {
		const collisions:FoundEntity[] = [];
		const room = this.getRoom(roomRef);
		if( aabbIntersectsWithOffset(ZERO_VECTOR, room.bounds, pos, bb) ) {
			this.solidEntitiesAt2( ZERO_VECTOR, roomRef, pos, bb, ignoreEntityId, collisions );
		}
		for( let n in room.neighbors ) {
			const neighb = room.neighbors[n];
			if( aabbIntersectsWithOffset(neighb.offset, neighb.bounds, pos, bb) ) {
				this.solidEntitiesAt2( neighb.offset, neighb.roomRef, pos, bb, ignoreEntityId, collisions );
			}
		}
		return collisions;
	}
	
	public playerEntityId?:string;
	public playerDesiredMovementDirection:Vector3D = ZERO_VECTOR;
	public update(interval:number=1/16) {
		for( let r in this.rooms ) {
			let room = this.rooms[r];
			for( let re in room.roomEntities ) {
				if( re == this.playerEntityId ) {
					room.roomEntities[re].entity.desiredMovementDirection = this.playerDesiredMovementDirection;
				}
			}
		}
		this.phys.updateEntities(interval);
		// For now we have to do this so that the view will see them,
		// since gdm doesn't have any way to track objects without saving them.
		// But it should eventually store our mutable rooms for us.
		this.flushUpdates();
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

export class MazeDemo {
	public datastore : Datastore<Uint16Array>;
	public game : MazeGame;
	public view : MazeView;
	public playerId : string;
	protected tickTimerId? : number;

	public startSimulation() {
		if( this.tickTimerId == undefined ) {
			this.tickTimerId = setInterval(this.tick.bind(this), 1000/16);
		}
	}
	public stopSimulation() {
		if( this.tickTimerId != undefined ) {
			clearInterval(this.tickTimerId);
			this.tickTimerId = undefined;
		}
	}
	
	protected tick() {
		this.game.update(1/16);
		this.updateView();
	}

	public updateView() {
		this.view.viewage = { items: [] };
		
		const playerLoc = this.game.locateRoomEntity(this.playerId);

		if( playerLoc ) {
			const rasterWidth = 31;
			const rasterHeight = 31;
			const rasterResolution = 2;
			const distance = 16;
			// Line up raster origin so it falls as close as possible to the center of the raster
			// while lining up edges with world coordinates
			const rasterOriginX = Math.floor(rasterWidth /rasterResolution/2) + playerLoc.position.x - Math.floor(playerLoc.position.x);
			const rasterOriginY = Math.floor(rasterHeight/rasterResolution/2) + playerLoc.position.y - Math.floor(playerLoc.position.y);
			const distanceInPixels = rasterResolution*distance;
			const opacityRaster = new ShadeRaster(rasterWidth, rasterHeight, rasterResolution, rasterOriginX, rasterOriginY);
			const visibilityRaster   = new ShadeRaster(rasterWidth, rasterHeight, rasterResolution, rasterOriginX, rasterOriginY);
			const sceneShader = new SceneShader(this.game.gameDataManager);
			sceneShader.sceneOpacityRaster(playerLoc.roomRef, scaleVector(playerLoc.position, -1), opacityRaster);
			if( isAllZero(opacityRaster.data) ) console.log("Opacity raster is all zero!");
			if( isAllNonZero(opacityRaster.data) ) console.log("Opacity raster is all nonzero!");
			sceneShader.opacityTolVisibilityRaster(opacityRaster, rasterOriginX*rasterResolution, rasterOriginY*rasterResolution, distanceInPixels, visibilityRaster);
			if( isAllZero(visibilityRaster.data) ) console.log("Visibility raster is all zero!");
			if( isAllNonZero(visibilityRaster.data) ) console.log("Visibility raster is all nonzero!");
			sceneShader.growVisibility(visibilityRaster); // Not quite!  Since this expands visibility into non-room space.
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
		this.keysDown[keyEvent.keyCode] = true;
		this.keysUpdated();
	}
	public keyUp(keyEvent:KeyboardEvent):void {
		delete this.keysDown[keyEvent.keyCode];
		this.keysUpdated();
	}
	public save():Promise<SaveGame> {
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
}

interface SaveGame {
	gameDataRef: string,
	rootRoomId: string,
	playerId: string,
}

export function startDemo(canv:HTMLCanvasElement) : MazeDemo {
	const ds = MemoryDatastore.createSha1Based(0); //HTTPHashDatastore();
	//const game = new MazeGame(gdm);
	//game.playerEntityId = playerEntityId;
	
	const v = new MazeView(canv);
	//v.gameDataManager = gdm;
	const viewItems : MazeViewageItem[] = [];
	
	const demo = new MazeDemo();
	demo.datastore = ds;
	//demo.game = game;
	demo.view = v;
	//demo.playerId = playerEntityId;
	
	const tempGdm = new GameDataManager(ds);
	initData(tempGdm).then( () => tempGdm.flushUpdates() ).then( (rootNodeUri) => {
		demo.loadGame( {
			gameDataRef: rootNodeUri,
			playerId: playerEntityId,
			rootRoomId: room1Id,
		});
		/*
		game.fullyLoadRooms(room1Id) ).then( () => {
		const room2 = game.activeRooms[room2Id];
		for( let i=0; i<10; ++i ) {
			const newBallId = newUuidRef();
			// add some balls!
			let position:Vector3D;
			while( game.solidEntitiesAt(room2Id, position = makeVector(0.5+3*Math.random(), -0.5-3*Math.random(), 0), HUNIT_CUBE).length > 0 );
			room2.roomEntities[newBallId] = {
				position: position,
				entity: { classRef: ballEntityClassId }
			};
		}
		demo.updateView();
		demo.startSimulation();
		*/
	});
	
	return demo;
}
