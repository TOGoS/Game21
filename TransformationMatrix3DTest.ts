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
	const rotate = TransformationMatrix3D.fromAxisAngle(axis, Math.PI/2);
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


const ident = TransformationMatrix3D.IDENTITY;

assertVectorsApproximatelyEqual(new Vector3D(1,2,3), ident.multiplyVector(new Vector3D(1,2,3)), "identity * vector should = that same vector");

const rightBy3 = TransformationMatrix3D.translation(new Vector3D(3,0,0));

assertVectorsApproximatelyEqual(new Vector3D(4,2,3), rightBy3.multiplyVector(new Vector3D(1,2,3)), "translating 1,2,3 by +3,0,0;\n"+rightBy3.toString());

// Alright now!
// Lets compose a couple of matrices and make sure that works out.

const upByTwo = TransformationMatrix3D.translation(new Vector3D(0,-2,0));
const rightBy3AndUpBy2 = rightBy3.multiply(upByTwo);

assertVectorsApproximatelyEqual(new Vector3D(4,0,3), rightBy3AndUpBy2.multiplyVector(new Vector3D(1,2,3)), "translating 1,2,3 by +3,-2,0;\n"+rightBy3.toString());

// Now something involving rotation, since that involves non-communtative matrix multiplication
// Let's say:
//   Move +x by 3
//   Rotate around +Y
//   Move +x by 2
// So, e.g. (0,0,0) -> (3,0,0) -> (0,0,-3) -> (+2,0,0)

const complexTransform = ident
	.multiply(TransformationMatrix3D.translation(new Vector3D(3,0,0)))
	.multiply(TransformationMatrix3D.fromAxisAngle(new Vector3D(0,1,0), Math.PI/2))
	.multiply(TransformationMatrix3D.translation(new Vector3D(2,0,0)));

assertVectorsApproximatelyEqual(new Vector3D(2,0,0), complexTransform.multiplyVector(new Vector3D(0,0,0)), "complex transform:\n"+complexTransform);
