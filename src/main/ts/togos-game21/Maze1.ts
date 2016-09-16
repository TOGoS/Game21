import GameDataManager from './GameDataManager';
import HTTPHashDatastore from './HTTPHashDatastore';
import MemoryDatastore from './MemoryDatastore';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import KeyedList from './KeyedList'; 

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
		(((col>> 0)&0xFF)/255)+')';
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

interface BitImageInfo {
	bitstr : string;
	color0 : number;
	color1 : number;
}

const oneBitImageDataRegex = /^bitimg:([^,]+),([0-9a-f]+)$/;
function parseBitImg( m:RegExpExecArray ):BitImageInfo {
	const modStrs = m[1].split(';');
	const modVals:KeyedList<any> = {}; // Actually strings!  But any makes |0 happy.
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
	console.log("modVals:",modVals);
	return {
		bitstr: m[2],
		color0: modVals['color0']|0,
		color1: modVals['color1']|0,
	}
}

// Uhm, hrm, should we use ARGB or RGBA?

function rgbaToNumber( r:number, g:number, b:number, a:number ):number {
	return ((r&0xFF)<<24) | ((g&0xFF)<<16) | ((b&0xFF)<<8) | (a&0xFF);
}

export class MazeView {
	public gameDataManager:GameDataManager;
	public constructor( public canvas:HTMLCanvasElement ) { }
	
	protected imageCache:KeyedList<HTMLImageElement> = {};

	protected getImage( ref:string ):HTMLImageElement {
		if( this.imageCache[ref] ) return this.imageCache[ref];

		const bitImgRee = oneBitImageDataRegex.exec(ref);
		let xRef = ref;
		if( bitImgRee ) {
			const bitImgInfo = parseBitImg(bitImgRee);
			xRef = parseOneBitImageDataToDataUrl( bitImgInfo.bitstr, 16, 16, bitImgInfo.color0, bitImgInfo.color1 );
		} else {
			throw new Error(ref+" not parse!");
		}

		const img = document.createElement("img");
		img.src = xRef;
		return this.imageCache[ref] = img; 
	}

	public draw():void {
		const ctx = this.canvas.getContext('2d');
		if( !ctx ) return;
		ctx.fillStyle = 'rgba(255,255,255,1.0)';
		//ctx.fillRect(0,0,16,16);

		const brikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(255,255,128,255)+","+
			hexEncodeBits(brikPix);
		const brikImg = this.getImage(brikImgRef);
		ctx.drawImage(brikImg, 0, 0);
	}
}

export function startDemo(canv:HTMLCanvasElement) {
	const v = new MazeView(canv);
	const ds = MemoryDatastore.createSha1Based(0); //HTTPHashDatastore();
	const dbmm = new DistributedBucketMapManager<string>(ds);
	v.gameDataManager = new GameDataManager(ds, dbmm);
	v.draw();
}
