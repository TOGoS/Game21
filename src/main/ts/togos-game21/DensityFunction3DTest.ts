import Vector3D from './Vector3D';
import DensityFunction3D, {makeDensityFunction} from './DensityFunction3D';

const dfDestVectorBuffer = new Vector3D;
const dfStartVectorBuffer = new Vector3D;

const findSurface = function( df:DensityFunction3D, start:Vector3D, z1:number=Infinity ):Vector3D {
	if( df.valueAtVector(start) > 0 ) return start;
	const v = df.findValue(start, Vector3D.K, 0, dfDestVectorBuffer);
	if( v === Infinity || v === -Infinity ) {
		dfDestVectorBuffer.set(start.x, start.y, Infinity);
	}
	return dfDestVectorBuffer;
}

function vectorToString( v:Vector3D, precision:number=4 ) {
	v = v.roundToGrid(1/64);
	return '('+v.toArray().map(a => a === Infinity ? 'Infinity' : a.toPrecision(precision)).join(',')+')';
}

function assertVectorsApproximatelyEqual( v0:Vector3D, v1:Vector3D, message?:string ) {
	const s0 = vectorToString(v0), s1 = vectorToString(v1);
	if( s0 != s1 ) {
		throw new Error(s0 + " != " + s1 + (message == null ? "" : "; "+message));
	}
}

const unitSphereDf:DensityFunction3D = makeDensityFunction( (x,y,z) => 1 - Math.sqrt(x*x+y*y+z*z) );

assertVectorsApproximatelyEqual(new Vector3D(0,0,-1), findSurface(unitSphereDf, new Vector3D(0, 0, -4)), "Center of sphere!" )
// It would be unreasonable to expect it to find the exact edge:
// assertVectorsApproximatelyEqual(new Vector3D(1,0,0), findSurface(unitSphereDf, new Vector3D(1, 0, -4)), "Edge of sphere!" )
assertVectorsApproximatelyEqual(new Vector3D(0.5,0,-Math.sqrt(1-0.5*0.5)), findSurface(unitSphereDf, new Vector3D(0.5, 0, -4)), "Off-center!")
assertVectorsApproximatelyEqual(new Vector3D(1,1,Infinity), findSurface(unitSphereDf, new Vector3D(1, 1, -4)), "Off sphere!")
