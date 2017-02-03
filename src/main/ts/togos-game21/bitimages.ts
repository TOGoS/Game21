import BitImageVisual from './BitImageVisual';
import KeyedList from './KeyedList';

const oneBitImageDataRegex = /^bitimg:([^,]+),([0-9a-f]+)$/;
export function parseBitImageVisualRefRegexResult( m:RegExpExecArray ):BitImageVisual {
	const modStrs = m[1].split(';');
	const pixelDataHex:string = m[2];
	const modVals:KeyedList<any> = {}; // Actually strings!  But any makes |0 happy.
	const length = pixelDataHex.length * 4;
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
	
	const width  = (modVals['width']  || defaultWidth )|0;
	const height = (modVals['height'] || defaultHeight)|0;
	
	const resolution = (modVals['resolution'] || 16)|0;
	
	const bitsPerPixel = 1;
	
	const colors = [];
	for( let i=0; i<2; ++i ) {
		const modC = modVals['color'+i];
		colors[i] = modC ? modC|0 : 0;
	}
	
	return {
		classRef: "http://ns.nuke24.net/Game21/BitImageVisual",
		bitsPerPixel,
		pixelDataHex,
		colors,
		width : width,
		height: height,
		originX: (modVals['originX'] || width /2)|0,
		originY: (modVals['originY'] || height/2)|0,
		originZ: (modVals['originZ'] || 0)|0,
		resolution,
	}
}

export function isBitImageVisualRef( ref:string ):RegExpExecArray|null {
	return oneBitImageDataRegex.exec(ref);
}

//// To image data

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

/*
 * Decodes a hex string into an element-per-bit array, big-endianly
 * e.g. "08F" becomes [0,0,0,0, 1,0,0,0, 1,1,1,1]
 */
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

function _bitImageVisualToRgbaData( enc:string, w:number, h:number, bitDepth:number, colors:number[] ):Uint8ClampedArray {
	if( bitDepth != 1 ) throw new Error("Only bitdepth = 1 bit images currently supported");
	const pixDat = hexDecodeBits(enc);
	
	const rgbaData = new Uint8ClampedArray(w*h*4);
	
	for( let i=0, j=0, y=0; y < h; ++y ) {
		for( let x = 0; x < w; ++x, ++i ) {
			const col = colors[pixDat[i]];
			rgbaData[j++] = (col >> 24)&0xFF;
			rgbaData[j++] = (col >> 16)&0xFF;
			rgbaData[j++] = (col >>  8)&0xFF;
			rgbaData[j++] = (col >>  0)&0xFF;
		}
	}
	
	return rgbaData;
}

export function bitImageVisualToRgbaData( visual:BitImageVisual ):Uint8ClampedArray {
	return _bitImageVisualToRgbaData( visual.pixelDataHex, visual.width, visual.height, visual.bitsPerPixel, visual.colors );
}
