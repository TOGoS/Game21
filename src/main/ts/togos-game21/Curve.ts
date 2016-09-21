import Vector3D from './Vector3D';
import { makeVector, setVector } from './vector3ds';
import { vectorDifferenceMagnitude, normalizeVector } from './vector3dmath';

/**
 * @param {number} t a number between 0 and 1 (inclusive, I guess?) indicating the point on the curve to calculate.
 * @param {Vector3D} v the vector to fill with the point information
 */
type Curve = (t:number, dest:Vector3D)=>void;

/**
 * Estimate curve length via subdivision
 */
export function estimateCurveLength(c:Curve, t0:number=0, t1:number=1, recurse:number=3, startBuf:Vector3D=makeVector(), endBuf:Vector3D=makeVector()):number {
	if( recurse == 0 ) {
		c(t0, startBuf);
		c(t1, endBuf  );
		const dist = vectorDifferenceMagnitude(startBuf, endBuf);
		return dist;
	} else {
		const tm = t0 + (t1-t0)/2;
		const l0 = estimateCurveLength(c, t0, tm, recurse-1, startBuf, endBuf);
		const l1 = estimateCurveLength(c, tm, t1, recurse-1, startBuf, endBuf);
		return l0+l1;
	}
}

export function estimateCurveTangent(c:Curve, t:number, buf:Vector3D=makeVector()) {
	const smallNum = 1/1024;
	c(t + 1/1024, buf);
	const x1 = buf.x, y1=buf.y, z1=buf.z;
	c(t - 1/1024, buf);
	buf = setVector(buf, x1-buf.x, y1-buf.y, z1-buf.z);
	return normalizeVector(buf, 1, buf);
}

export default Curve;
