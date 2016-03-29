(function() {
"use strict";

var addVect3d = function( v0, v1 ) {
	return [v0[0]+v1[0], v0[1]+v1[1], v0[2]+v1[2]];
};
var subtractVect3d = function( v0, v1 ) {
	return [v0[0]-v1[0], v0[1]-v1[1], v0[2]-v1[2]];
};
var scaleAndAccumulateVect3d = function( v, s, res ) {
	res[0] += v[0]*s;
	res[1] += v[1]*s;
	res[2] += v[2]*s;
};

var makeCubicBezierCurve = function( p0, p1, p2, p3 ) {
	return function(t, res) {
		if( res == null ) res = [0,0,0];
		else { res[0] = 0; res[1] = 0; res[2] = 0; }
		
		var m = 1 - t;
		scaleAndAccumulateVect3d( p0,   m*m*m, res );
		scaleAndAccumulateVect3d( p1, 3*m*m*t, res );
		scaleAndAccumulateVect3d( p2, 3*m*t*t, res );
		scaleAndAccumulateVect3d( p3,   t*t*t, res );
		return res;
	};
};

window.makeCubicBezierCurve = makeCubicBezierCurve;

})();
