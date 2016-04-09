import Rectangle from './Rectangle';
import Vector3D from './Vector3D';
import ShapeSheet from './ShapeSheet';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil from './ShapeSheetUtil';
import ImageSlice from './ImageSlice';
import {DEFAULT_LIGHTS} from './Lights';
import {DEFAULT_MATERIALS} from './Materials';

function isEmpty(ss:ShapeSheet):boolean {
	for( let y:number=0; y<ss.height; ++y ) for( let x:number=0, i=x+y*ss.width; x<ss.width; ++x, ++i ) {
		const nonInf:boolean =
			ss.cellCornerDepths[i*4+0] < Infinity ||
			ss.cellCornerDepths[i*4+1] < Infinity ||
			ss.cellCornerDepths[i*4+2] < Infinity ||
			ss.cellCornerDepths[i*4+3] < Infinity;
		const hasMaterial = ss.cellMaterialIndexes[i] != 0;
		if( hasMaterial && nonInf ) return false;
	}
	return true;
}

export default class SSIDemo {
	public static randomShapeImage():HTMLImageElement {
		let materials = DEFAULT_MATERIALS;
		let lights = DEFAULT_LIGHTS;
		const ss = new ShapeSheet(128,128);
		const ssu = new ShapeSheetUtil(ss);
		ssu.plotSphere( 32, 32, 0, 32 );
		if( isEmpty(ss) ) throw new Error("ShapeSheet unexpectedly empty after plotSphere");
		
		const sss = new ImageSlice(ss, new Vector3D(32,32,0), 16, new Rectangle(0,0,128,128));
		const croppedSss:ImageSlice<ShapeSheet> = ShapeSheetUtil.autocrop(sss, true);
		if( isEmpty(croppedSss.sheet) ) throw new Error("ShapeSheet unexpectedly empty after cropping");
		return ShapeSheetRenderer.shapeSheetToImage(croppedSss.sheet, materials, lights);
	};
}
