import Vector3D from './Vector3D';
import { makeVector, setVector, vectorToArray, K_VECTOR } from './vector3ds';
import { roundVectorToGrid } from './vector3dmath';
import DensityFunction3D, {makeDensityFunction} from './DensityFunction3D';

const dfDestVectorBuffer = makeVector();
const dfStartVectorBuffer = makeVector();

const findSurface = function( df:DensityFunction3D, start:Vector3D, z1:number=Infinity ):Vector3D {
	if( df.valueAtVector(start) > 0 ) return start;
	const v = df.findValue(start, K_VECTOR, 0, dfDestVectorBuffer);
	if( v === Infinity || v === -Infinity ) {
		setVector(dfDestVectorBuffer, start.x, start.y, Infinity);
	}
	return dfDestVectorBuffer;
}

function vectorToString( v:Vector3D, precision:number=4 ) {
	v = roundVectorToGrid(v, 1/64);
	return '('+vectorToArray(v).map(a => a === Infinity ? 'Infinity' : a.toPrecision(precision)).join(',')+')';
}

function assertVectorsApproximatelyEqual( v0:Vector3D, v1:Vector3D, message?:string ) {
	const s0 = vectorToString(v0), s1 = vectorToString(v1);
	if( s0 != s1 ) {
		throw new Error(s0 + " != " + s1 + (message == null ? "" : "; "+message));
	}
}

const unitSphereDf:DensityFunction3D = makeDensityFunction( (x,y,z) => 1 - Math.sqrt(x*x+y*y+z*z) );

assertVectorsApproximatelyEqual(makeVector(0,0,-1), findSurface(unitSphereDf, makeVector(0, 0, -4)), "Center of sphere!" )
// It would be unreasonable to expect it to find the exact edge:
// assertVectorsApproximatelyEqual(makeVector(1,0,0), findSurface(unitSphereDf, makeVector(1, 0, -4)), "Edge of sphere!" )
assertVectorsApproximatelyEqual(makeVector(0.5,0,-Math.sqrt(1-0.5*0.5)), findSurface(unitSphereDf, makeVector(0.5, 0, -4)), "Off-center!")
assertVectorsApproximatelyEqual(makeVector(1,1,Infinity), findSurface(unitSphereDf, makeVector(1, 1, -4)), "Off sphere!")
