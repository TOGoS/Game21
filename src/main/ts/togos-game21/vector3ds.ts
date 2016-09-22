import Vector3D from './Vector3D';
import { deepFreeze } from './DeepFreezer'; 

export function makeVector(x:number=0, y:number=0, z:number=0):Vector3D {
	return {x, y, z};
}

export function setVector(v:Vector3D|undefined|null, x:number, y:number, z:number):Vector3D {
	if( v ) {
		v.x = x; v.y = y; v.z = z;
	} else {
		v = {x, y, z}
	}
	return v;
}

export const ZERO_VECTOR = deepFreeze(makeVector(0,0,0));
export const I_VECTOR    = deepFreeze(makeVector(1,0,0));
export const J_VECTOR    = deepFreeze(makeVector(0,1,0));
export const K_VECTOR    = deepFreeze(makeVector(0,0,1));
export const TEMP_VECTOR = makeVector();

export function vectorToArray(v:Vector3D):number[] {
    return [v.x, v.y, v.z];
}

export function vectorToString(v:Vector3D|undefined|null):string {
	if( v === undefined ) return '(undefined vector)';
	if( v === null ) return '(null vector)';
	return "<"+v.x.toFixed(3)+","+v.y.toFixed(3)+","+v.z.toFixed(3)+">";
}

export function parseVector(a:any):Vector3D {
	if( typeof a.x == 'number' && typeof a.y == 'number' && typeof a.z == 'number' ) return a;
	if( typeof a[0] == 'number' && typeof a[1] == 'number' && typeof a[2] == 'number' ) {
		return makeVector(a[0],a[1],a[2]);
	}
	return makeVector(+a.x,+a.y,+a.z);
}