import Vector3D from './Vector3D';

type Vector3DBuffer = Vector3D;

/**
 * @param {number} t a number between 0 and 1 (inclusive, I guess?) indicating the point on the curve to calculate.
 * @param {Vector3D} v the vector to fill with the point information
 */
type Curve = (t:number, v:Vector3DBuffer)=>void;

/**
 * Estimate curve length via subdivision
 */
export function estimateCurveLength(c:Curve, t0:number=0, t1:number=1, recurse:number=3, startBuf:Vector3D=new Vector3D, endBuf:Vector3D=new Vector3D):number {
	if( recurse == 0 ) {
		c(t0, startBuf);
		c(t1, endBuf  );
		const dist = Vector3D.differenceMagnitude(startBuf, endBuf);
		return dist;
	} else {
		const tm = t0 + (t1-t0)/2;
		const l0 = estimateCurveLength(c, t0, tm, recurse-1, startBuf, endBuf);
		const l1 = estimateCurveLength(c, tm, t1, recurse-1, startBuf, endBuf);
		return l0+l1;
	}
}

export default Curve;
