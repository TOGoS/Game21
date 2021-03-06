import Vector3D from './Vector3D';
import { setVector } from './vector3ds';
import Curve from './Curve';

type Vector3DBuffer = Vector3D;

var scaleAndAccumulateVect3d = function( v:Vector3D, s:number, res:Vector3DBuffer ):void {
	res.x += v.x*s;
	res.y += v.y*s;
	res.z += v.z*s;
};

export function makeCubicBezierCurve( p0:Vector3D, p1:Vector3D, p2:Vector3D, p3:Vector3D ):Curve {
	return function(t:number, res:Vector3DBuffer):void {
		setVector(res, 0,0,0);
		const m = 1 - t;
		scaleAndAccumulateVect3d( p0,   m*m*m, res );
		scaleAndAccumulateVect3d( p1, 3*m*m*t, res );
		scaleAndAccumulateVect3d( p2, 3*m*t*t, res );
		scaleAndAccumulateVect3d( p3,   t*t*t, res );
	};
};
