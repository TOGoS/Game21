import Vector3D from './Vector3D';
import Rectangle from './Rectangle';

export default class ImageSlice<ImageType> {
	// When serialized, sheet will be replaced with a hash-based sheetRef
	public sheetRef:string;
	/**
	 * @param {ShapeSheet} sheet the image or shapesheet (or whatever) that we slice
	 * @param {Vector3D} origin gives the point on the shapesheet (relative
	 *   to the entire shapesheet, not the bounded area) that corresponds
	 *   to the object's position
	 * @param {number} resolution pixels per world unit (world unit being 'meters')
	 * @param {Rectangle} bounds the region of the shapesheet to be drawn
	 */
	public constructor(public sheet:ImageType, public origin:Vector3D, public resolution:number, public bounds:Rectangle ) { }
}
