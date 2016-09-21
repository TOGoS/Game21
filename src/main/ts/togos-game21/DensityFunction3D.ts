import Vector3D from './Vector3D';
import { makeVector, setVector, TEMP_VECTOR } from './vector3ds'
import { normalizeVector } from './vector3dmath';

interface DensityFunction3D
{
	(x:number,y:number,z:number):number;
	valueAtVector(v:Vector3D):number;
	/**
	 * Set 'dest' to the point approximately at which density=value would be found.
	 * Returns a positive number if density between start and dest was positive.
	 * Returns a negative number if density between start and dest was positive.
	 * Returns +Infinity if density at start is positive and surface is never hit.
	 * Returns iInfinity if density at start is negative and surface is never hit.
	 */
	findValue(start:Vector3D, direction:Vector3D, targetValue:number, dest:Vector3D, maxIterations?:number):number;
}

function extimateMaxGradient(f:(x:number,y:number,z:number)=>number ):number {
	let max = 0;
	for( let i=0; i<100; ++i ) {
		const sAmp = Math.random()*Math.random()*Math.random()*10000;
		const x = Math.random()*sAmp;
		const y = Math.random()*sAmp;
		const z = Math.random()*sAmp;
		const v = f(x,y,z);
		for( let j=0; j<10; ++j ) {
			const dAmp = Math.random()*Math.random()*Math.random()*10;
			const dx = Math.random()*dAmp;
			const dy = Math.random()*dAmp;
			const dz = Math.random()*dAmp;
			const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
			if( dist == 0 ) continue;
			const v1 = f(x+dx, y+dy, z+dz);
			max = Math.max(max, Math.abs(v1-v) / dist);
		}
	}
	return max;
}

const normalizedDirection:Vector3D = makeVector();
const goVectorBuffer:Vector3D = TEMP_VECTOR;
const newVect0:Vector3D = makeVector();
const newVect1:Vector3D = makeVector();

const addScaled = function(v0:Vector3D, v1:Vector3D, scale:number, dest:Vector3D):Vector3D {
	dest.x = v0.x + v1.x*scale;
	dest.y = v0.y + v1.y*scale;
	dest.z = v0.z + v1.z*scale;
	return dest;
}

export function makeDensityFunction( f:(x:number,y:number,z:number)=>number ):DensityFunction3D {
	const df:any = function(x:number,y:number,z:number):number {
		return f(x,y,z);
	}
	const maxGradient = extimateMaxGradient(f);
	df.valueAtVector = function(v:Vector3D):number {
		return f(v.x, v.y, v.z);
	}
	df.findValue = function(start:Vector3D, direction:Vector3D, targetValue:number, dest:Vector3D, maxIterations:number=10):number {
		normalizeVector(direction, 1, normalizedDirection);
		const initialValue = f(start.x,start.y,start.z);
		setVector(dest, start.x, start.y, start.z);
		let iter = maxIterations;
		let cv = initialValue;
		const fwd = initialValue < 0 ? -1 : +1;
		while( iter > 0 ) {
			const go = 1.5 * fwd * (cv - targetValue) / maxGradient;
			if( go == 0 ) break;
			
			addScaled(dest, normalizedDirection, go, dest);
			
			// Set up for next iteration
			cv = f(dest.x, dest.y, dest.z);
			--iter;
		}
		const finalValue = cv;
		return Math.abs(finalValue) < Math.abs(initialValue) ? initialValue : initialValue > 0 ? +Infinity : -Infinity;
	} 
	return df;
}

export default DensityFunction3D;
