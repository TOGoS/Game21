import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
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
	const rotatedNormal = rotate.multiplyVector(input);
	assertVectorsApproximatelyEqual( expected, rotatedNormal, vectorToString(input)+" rotated around axis "+vectorToString(axis)+"; matrix:\n"+rotate.toString());
	
	const q = Quaternion.fromAxisAngle( axis, angle );
	const qRotate = TransformationMatrix3D.fromQuaternion(q);
	const rotatedQuaternionly = qRotate.multiplyVector(input);
	assertVectorsApproximatelyEqual( expected, rotatedNormal, vectorToString(input)+" rotated around axis "+vectorToString(axis)+" using quaternion: "+q.toString()+"; matrix:\n"+rotate.toString());
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
// Construct the matrix in outermost->innermost outer

{
	const complexTransform = ident
		.multiply(TransformationMatrix3D.fromAxisAngle(new Vector3D(0,1,0), Math.PI/2))
		.multiply(TransformationMatrix3D.translation(new Vector3D(3,0,0)))

	assertVectorsApproximatelyEqual(new Vector3D(0,0,-3), complexTransform.multiplyVector(Vector3D.ZERO), "complex transform:\n"+complexTransform);
}

{
	// Let's say (innermost to outermost)
	//   Move +x by 3
	//   Rotate around +Y
	//   Move +x by 2
	// So, e.g. (0,0,0) -> (3,0,0) -> (0,0,-3) -> (+2,0,-3)
	
	const complexTransform = ident
		.multiply(TransformationMatrix3D.translation(new Vector3D(2,0,0)))
		.multiply(TransformationMatrix3D.fromAxisAngle(new Vector3D(0,1,0), Math.PI/2))
		.multiply(TransformationMatrix3D.translation(new Vector3D(3,0,0)));

	assertVectorsApproximatelyEqual(new Vector3D(2,0,-3), complexTransform.multiplyVector(Vector3D.ZERO), "complex transform:\n"+complexTransform);
}

{
	// One with scaling!
	//   Move +x by 3
	//   Scale by 2
	//   Rotate around +Y
	//   Move +x by 2
	// So, e.g. (0,0,0) -> (3,0,0) -> (6,0,0) -> (0,0,-6) -> (+2,0,-3)
	
	const complexTransform = ident
		.multiply(TransformationMatrix3D.translation(new Vector3D(2,0,0)))
		.multiply(TransformationMatrix3D.fromAxisAngle(new Vector3D(0,1,0), Math.PI/2))
		.multiply(TransformationMatrix3D.scale(2))
		.multiply(TransformationMatrix3D.translation(new Vector3D(3,0,0)));

	assertVectorsApproximatelyEqual(new Vector3D(2,0,-6), complexTransform.multiplyVector(Vector3D.ZERO), "complex transform:\n"+complexTransform);
}


// Okay, now let's play with quaternions.
// Because I don't know how to test them separately from transformation matrices

{
	// For starters lets make sure the identity quaternion doesn't do anything
	const q = Quaternion.fromXYZAxisAngle(1, 0, 0, 0);
	const someVectors = [Vector3D.ZERO, Vector3D.I, Vector3D.J, Vector3D.K, new Vector3D(1,2,3)];
	for( const v in someVectors ) {
		const xm = TransformationMatrix3D.fromQuaternion(q);
		assertVectorsApproximatelyEqual(someVectors[v], xm.multiplyVector(someVectors[v]));
	}
}
