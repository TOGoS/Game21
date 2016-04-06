import Vector3D from './Vector3D';
import TransformationMatrix3D from './TransformationMatrix3D';

function vectorToString( v:Vector3D, precision:number=4 ) {
	v = v.roundToGrid(1/64);
	return '('+v.toArray().map(a => a.toPrecision(precision)).join(',')+')';
}
function assertVectorsApproximatelyEqual( v0:Vector3D, v1:Vector3D, message?:string ) {
	const s0 = vectorToString(v0), s1 = vectorToString(v1);
	if( s0 != s1 ) {
		throw new Error(s0 + " != " + s1 + (message == null ? "" : "; "+message));
	}
}

function assertRotation( expected:Vector3D, input:Vector3D, axis:Vector3D, angle:number ) {
	const rotate = TransformationMatrix3D.fromAxisAngle2(axis, Math.PI/2);
	const rotated = rotate.multiplyVector( input );
	assertVectorsApproximatelyEqual( expected, rotated, vectorToString(input)+" rotated around axis "+vectorToString(axis)+"; matrix:\n"+rotate.toString());
}

assertRotation( new Vector3D(0,0,-1), new Vector3D(1,0,0), new Vector3D(0,1,0), Math.PI/2 );

// The plane on http://www.euclideanspace.com/maths/geometry/rotations/conversions/angleToMatrix/:
// its 'up' (+y) becomes 'towards the viewer' (+z)
// (they're using a right-handed coordinate system,
// instead of left-handed like we show on our screens,
// but the numbers should work out the same)
assertRotation( new Vector3D(0,0,+1), new Vector3D(0,1,0), new Vector3D(1,0,0), Math.PI/2 );
