interface BitImageVisual {
	classRef : "http://ns.nuke24.net/Game21/BitImageVisual";
	pixelDataHex : string;
	bitsPerPixel : number;
	colors : number[];
	width  : number;
	height : number;
	originX: number;
	originY: number;
	originZ: number;
	resolution: number;
}

export default BitImageVisual;
