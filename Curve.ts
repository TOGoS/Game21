import Vector3D from './Vector3D';

type Vector3DBuffer = Vector3D;

/**
 * @param {number} t a number between 0 and 1 (inclusive, I guess?) indicating the point on the curve to calculate.
 * @param {Vector3D} v the vector to fill with the point information
 */
type Curve = (t:number, v:Vector3DBuffer)=>void;

export default Curve;
