import Vector3D from './Vector3D';
import AABB from './AABB';

export default class ImageSlice<ImageType> {
	// When serialized, sheet will be replaced with a hash-based sheetRef
	public sheetRef:string;
	/**
	 * @param {ShapeSheet} sheet the image or shapesheet (or whatever) that we slice
	 * @param {Vector3D} position on the sheet (in sheet pixel coordinates)
	 *   corresponding to the slice's center
	 * @param {number} resolution pixels per world unit (world unit being 'meters')
	 * @param {AABB} bounds the region of the shapesheet to be drawn in sheet pixel coordinates;
	 *   if image is 2D, Z of bounds indicates minimum/maximum Z (in pixel units) of represented 3D thing
	 * 
	 * 'in sheet pixel coordinates' means numbers represent number of pixels left/down/inward
	 * from the top/left/front corner of the backing sheet.
	 */
	public constructor(public sheet:ImageType, public origin:Vector3D, public resolution:number, public bounds:AABB ) { }
}
