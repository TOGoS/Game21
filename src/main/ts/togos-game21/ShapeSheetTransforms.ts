import ShapeSheet from './ShapeSheet';

export default class ShapeSheetTransforms {
	public static clone(source:ShapeSheet, x:number, y:number, w:number, h:number, flipX:boolean, rot:number) {
		if( x == null ) x = 0;
		if( y == null ) y = 0;
		if( w == null ) w = source.width  - x;
		if( h == null ) h = source.height - y;
		if( flipX == null ) flipX = false;
		if( rot == null ) rot = 0;
		
		if( x < 0 ) throw new Error("x ("+x+") outta bounds!");
		if( y < 0 ) throw new Error("y ("+y+") outta bounds!");
		if( x+w > source.width  ) throw new Error("w ("+x+"+"+w+") outta bounds ("+source.width+")!");
		if( y+h > source.height ) throw new Error("w ("+y+"+"+h+") outta bounds ("+source.height+")!");
		
		// Corner indexe and pixel coordinate transforms modeled as
		// are f(index/coord within new image) = index/coord within source image
		
		var cornerRot:number; // 0 or 1; how many 90-degree rotations to apply
		var cornerXor = flipX ? 1 : 0; // what to xor corner indexes by after
		// At a 90degree turn, corner N of our new image maps to corner cornerRotList[N] of the old one
		var cornerRotList = [2, 0, 3, 1];
		
		// Transform matrix for new image x,y -> old image x,y
		var transform:number[];
		// Before rotation, old pixel X = new pixel X * transXX + transX1
		var transXX = flipX ? -1 : 1;
		var transX1    = flipX ? x+w-1 : x;
		var invTransX1 = flipX ? x : x+w-1;
		
		var cw:number, ch:number;
		if( rot == 90 || rot == 270 ) {
			cw = h; ch = w;
		} else {
			cw = w; ch = h;
		}
		
		if( rot == 0 ) {
			transform = [
				+transXX, 0, transX1,
						0, 1, y
			];
			cornerRot = 0;
		} else if( rot == 90 ) {
			transform = [
				0, transXX, transX1, 
				-1,       0, y+h-1
			];
			cornerRot = 1;
		} else if( rot == 180 ) {
			transform = [
				-transXX,  0, invTransX1,
						0, -1, y+h-1
			];
			cornerRot = 0;
			cornerXor ^= 3;
		} else if( rot == 270 ) {
			transform = [
				0, -transXX, invTransX1, 
				1,        0, y
			];
			cornerRot  = 1;
			cornerXor ^= 3;
		} else {
			throw new Error("Invalid rotation: "+rot);
		}
		
		/*
		Figuring corner transformations...
		apply cornerRot, then cornerXor
		
		0, no flip
		should be: 0 -> 0, 1 -> 1, 2 -> 2, 3 -> 3
		cornerRot = 0, cornerXor = 0
		
		90, no flip
		should be: 0 -> 2, 1 -> 0, 2 -> 3, 3 -> 1
		cornerRot = 1, cornerXor = 0;
		does     : 0 -> 2, 1 -> 0, 2 -> 3, 3 -> 1
		
		180, no flip:
		should be: 0 -> 3, 1 -> 2, 2 -> 1, 3 -> 0
		cornerRot = 0, cornerXor = 3
		does

		270, no flip:
		should be: 0 -> 1, 1 -> 3, 2 -> 0, 3 -> 2
		conerRot = 1, cornerXor = 3
		does     : 0 -> 1, 1 -> 3, 2 -> 0, 3 -> 2
		
		0, flip:
		should be: 0 -> 1, 1 -> 0, 2 -> 3, 3 -> 2
		cornerRot = 0, cornerXor = 1
		
		90, flip:
		should be: 0 -> 3, 1 -> 1, 2 -> 2, 3 -> 0
		cornerRot = 1, cornerXor = 1
		does     : 0 -> 2, 1 -> 0, 2 -> 3, 3 -> 1
		
		*/
		
		var clone = new ShapeSheet(cw,ch);
		
		var ci:number, cx:number, cy:number, sx:number, sy:number, cc:number, sc:number, si:number;
		for( ci=0, cy=0; cy < ch; ++cy ) {
			for( cx=0; cx < cw; ++cx, ++ci ) {
				sx = cx*transform[0]+cy*transform[1]+transform[2];
				sy = cx*transform[3]+cy*transform[4]+transform[5];
				si = source.width * sy + sx;
				for( cc=0; cc < 4; ++cc ) {
					sc = (cornerRot == 0) ? cc : cornerRotList[cc];
					sc ^= cornerXor;
					throw new Error("ha ha ha this thing needs some re-work.  Good thing I never use it!");
					//clone.cellCornerDepths[ci*4+cc] = source.cellCornerDepths[si*4+sc];
				}
				clone.cellMaterialIndexes[ci] = source.cellMaterialIndexes[si];
			}
		}
		
		return clone;
	}
};
