import Vector3D from './Vector3D';
import { makeVector, setVector } from './vector3ds';

function roundToNearestMultiple(n:number, gridSize:number):number {
	return Math.round(n/gridSize) * gridSize;
}

export function scaleVector( v:Vector3D, s:number, dest?:Vector3D ):Vector3D {
	if( s == 1 && dest == null ) return v;
	return setVector(dest, v.x*s, v.y*s, v.z*s);
}

export function vectorIsZero( v:Vector3D ):boolean {
	return v.x == 0 && v.y == 0 && v.z == 0;
}

export function vectorLength( v:Vector3D ):number {
	return Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
}
export function normalizeVector(vec:Vector3D, targetLength:number=1, dest?:Vector3D):Vector3D {
	const len = vectorLength(vec);
	const sca = len == 0 ? 1 : targetLength/len;
	return scaleVector( vec, sca, dest );
}

export function accumulateVector( v0:Vector3D, dest:Vector3D, scale:number=1 ):Vector3D {
	dest.x += v0.x*scale;
	dest.y += v0.y*scale;
	dest.z += v0.z*scale;
	return dest;
}

export function addVector( v0:Vector3D, v1:Vector3D, dest?:Vector3D ):Vector3D {
	return setVector(dest, v0.x+v1.x, v0.y+v1.y, v0.z+v1.z);
}

export function subtractVector( v0:Vector3D, v1:Vector3D, dest?:Vector3D ):Vector3D {
	return setVector(dest, v0.x-v1.x, v0.y-v1.y, v0.z-v1.z);
}

export function vectorDifferenceMagnitude( v0:Vector3D, v1:Vector3D ):number {
	// return subtract(v0,v1).length
	const dx=v0.x-v1.x, dy=v0.y-v1.y, dz=v0.z-v1.z;
	return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

export function roundVectorToGrid(vec:Vector3D, xGrid:number=1, yGrid:number=xGrid, zGrid:number=xGrid, dest?:Vector3D) : Vector3D {
	return setVector(
        dest,
		roundToNearestMultiple(vec.x, xGrid),
		roundToNearestMultiple(vec.y, yGrid),
		roundToNearestMultiple(vec.z, zGrid)
	);
}

export function dotProduct(v0:Vector3D, v1:Vector3D):number {
	return v0.x*v1.x + v0.y*v1.y + v0.z*v1.z;
}
