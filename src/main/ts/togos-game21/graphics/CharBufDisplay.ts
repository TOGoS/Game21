export interface CharBufDisplay {
	columnCount : number;
	rowCount : number;
	charWidth : number;
	charHeight : number;
	// 'Mounting point', in pixels; by default this is the center of the screen
	originX? : number;
	originY? : number;
	
	// Buffer format: 32 bits per cell:
	// <char code> <charset ID> <fg color> <bg color>
	// by default, charset 0 is a built-in 8x8 code page 437 font
	// Way to indicate other charsets TBD
	// colors are represented as 2 bits each: R,G,B,A
	characterBuffer : number[]; // Should be a Uint8Array, but any number[] should work
}

export default CharBufDisplay;

import SimpleBitmapFont from './SimpleBitmapFont';

type Font = SimpleBitmapFont;

const colorComponentExpansion = [0, 85, 170, 255];

function decodeColorByte( b:number, into:Uint8ClampedArray, offset:number ) {
	into[offset+0] = colorComponentExpansion[(b >> 6) & 3];
	into[offset+1] = colorComponentExpansion[(b >> 4) & 3];
	into[offset+2] = colorComponentExpansion[(b >> 2) & 3];
	into[offset+3] = colorComponentExpansion[(b >> 0) & 3];
}

export function putText(
	display:CharBufDisplay,
	x0:number, y0:number, text:string,
	charsetId?:number, fgColor?:number, bgColor?:number
) {
	if( y0 < 0 || y0 >= display.rowCount ) return;
	const buf = display.characterBuffer;
	const wid = display.columnCount;
	for( let i=0, x=x0; i<text.length && x >= 0 && x < wid; ++x, ++i ) {
		const idx = y0*wid + x;
		buf[(idx<<2)+0] = text.charCodeAt(i);
		if( charsetId != null ) buf[(idx<<2)+1] = charsetId;
		if( fgColor   != null ) buf[(idx<<2)+2] = fgColor;
		if( bgColor   != null ) buf[(idx<<2)+3] = bgColor;
	}
}

export function displayToPixelData(
	display:CharBufDisplay, col0:number=0, row0:number=0, col1:number=0, row1:number=0,
	fonts:Font[],
	pixelData:Uint8ClampedArray = new Uint8ClampedArray(display.columnCount*display.charWidth*display.rowCount*display.charHeight)
):Uint8ClampedArray {
	if( row0 < 0 ) row0 = 0;
	if( col0 < 0 ) col0 = 0;
	if( row1 > display.rowCount ) row1 = display.rowCount;
	if( col1 > display.columnCount ) col1 = display.columnCount;
	const charDat = display.characterBuffer;
	const charWidth = display.charWidth;
	const screenWidthInPixels = display.columnCount*charWidth;
	const charWidthOver8 = charWidth / 8;
	const charHeight = display.charHeight;
	if( charWidth != 8 ) throw new Error("Hahaha only 8-pixel-wide chars supported for now");
	for( let row=row0; row<row1; ++row ) {
		for( let col=col0; col<col1; ++col ) {
			let idx = display.columnCount * row + col;
			const charId = charDat[(idx<<2) + 0];
			const setId  = charDat[(idx<<2) + 1];
			// Ignore set ID and colors for now...
			const fgColor = 0xFF; // charDat[(idx<<2) + 2];
			const bgColor = 0x03; // charDat[(idx<<2) + 3];
			const font = fonts[setId];
			if( font == undefined ) continue;
			// Also, font character size had better match display character size!
			for( let py=0; py<charHeight; ++py ) {
				const fontRow = font.data[charHeight*charId+py];
				for( let px=0; px<charWidth; ++px ) {
					const color = ((fontRow << px) & 0x80) == 0x80 ? fgColor : bgColor;
					decodeColorByte( color, pixelData, (screenWidthInPixels*(py+row*charHeight) + charWidth*col+px)<<2 );
				}
			}
		}
	}
	return pixelData;
}
