import Rectangle from './Rectangle';
import Vector3D from './Vector3D';
import ShapeSheet from './ShapeSheet';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil from './ShapeSheetUtil';
import ImageSlice from './ImageSlice';
import {DEFAULT_LIGHTS} from './Lights';
import {DEFAULT_MATERIALS} from './Materials';

export default class SSIDemo {
	public static randomShapeImage():HTMLImageElement {
		let materials = DEFAULT_MATERIALS;
		let lights = DEFAULT_LIGHTS;
		const ss = new ShapeSheet(160,160);
		const ssu = new ShapeSheetUtil(ss);
		ssu.plotSphere( 80, 80, 0, 32 );
		
		const sss = new ImageSlice(ss, new Vector3D(80,80,0), 16, new Rectangle(0,0,128,128));
		const croppedSss:ImageSlice<ShapeSheet> = ShapeSheetUtil.autocrop(sss, true);
		return ShapeSheetRenderer.shapeSheetToImage(croppedSss.sheet, materials, lights);
	};
}
