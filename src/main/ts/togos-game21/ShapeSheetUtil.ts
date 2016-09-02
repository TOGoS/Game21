const LARGE_NUMBER = 1000;

import Vector3D from './Vector3D';
import Curve from './Curve';
import Rectangle from './Rectangle';
import Cuboid from './Cuboid';
import ShapeSheet from './ShapeSheet';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import DensityFunction3D from './DensityFunction3D';
import PlotMode from './PlotMode';

// For slicing stuff, which maybe doesn't really belong here
import ProceduralShape from './ProceduralShape';
import TransformationMatrix3D from './TransformationMatrix3D';
import Quaternion from './Quaternion';
import ImageSlice from './ImageSlice';

export type PlottedMaterialIndexFunction = (x:number, y:number, z:number, z0:number, z1:number, z2:number, z3:number)=>number;
export type PlottedDepthFunction = (x:number, y:number, z:number)=>number;
export type PlotFunction = (x:number, y:number, z:number, rad:number)=>void;
type Vector3DBuffer = Vector3D;

export function constantMaterialIndexFunction( v:number ) {
	return function(x:number,y:number,z:number,z0:number,z1:number,z2:number,z3:number) { return v; };
};

var infiniMinus = function(a:number, b:number):number {
	if( a === b ) return 0;
	if( a === +Infinity ) {
		if( b === -Infinity ) return 0;
		return +LARGE_NUMBER;
	}
	if( a === -Infinity ) {
		if( b === +Infinity ) return 0;
		return -LARGE_NUMBER;
	}
	return a - b;
};

// fit vector to [-1..1, -1..1, -inf..inf]
function normalizeVect3dToXYUnitSquare(vect:Vector3D):Vector3D {
	var len = Math.max(Math.abs(vect.x), Math.abs(vect.y));
	if( len == 0 ) return vect;
	return vect.scale(1/len);
};

function disto( x0:number, y0:number, z0:number, x1:number, y1:number, z1:number ):number {
	var dx = x1-x0, dy = y1-y0, dz = z1-z0;
	return Math.sqrt( dx*dx + dy*dy + dz*dz );
};

function reversePointList( points:Array<number> ):Array<number> {
	let reversed = new Array(points.length);
	const pointCount = points.length / 3;
	for( let i = 0; i < pointCount; ++i ) {
		const ioff = (pointCount-1-i)*3;
		const ooff = i*3;
		reversed[ooff+0] = points[ioff+0];
		reversed[ooff+1] = points[ioff+1];
		reversed[ooff+2] = points[ioff+2];
	}
	return reversed;
}

export const NOOP_PLOTTED_DEPTH_FUNCTION = (x:number,y:number,z:number):number => z;

const dfDestVectorBuffer = new Vector3D;
const dfStartVectorBuffer = new Vector3D;

const findSurfaceZ = function( df:DensityFunction3D, x:number, y:number, z0:number, z1:number=Infinity, maxIterations:number=10 ):number {
	if( df(x,y,z0) > 0 ) return z0;
	dfStartVectorBuffer.set(x,y,z0);
	const v = df.findValue(dfStartVectorBuffer, Vector3D.K, 0, dfDestVectorBuffer, maxIterations);
	if( v === Infinity || v === -Infinity ) {
		return Infinity;
	}
	return dfDestVectorBuffer.z;
}

class ShapeSheetUtil {
	protected _shapeSheet:ShapeSheet;
	protected _renderer:ShapeSheetRenderer|undefined;
	public plottedMaterialIndexFunction:PlottedMaterialIndexFunction;
	public plottedDepthFunction:PlottedDepthFunction;
	public plotMode:PlotMode;
	
	constructor(shapeSheet:ShapeSheet, renderer?:ShapeSheetRenderer) {
		this._shapeSheet = shapeSheet;
		this._renderer = renderer;
		this.plottedMaterialIndexFunction = function(x, y, z, z0, z1, z2, z3) {
			return 4 + (Math.random()*4)|0;
		};
		this.plottedDepthFunction = NOOP_PLOTTED_DEPTH_FUNCTION;
		this.plotMode = PlotMode.DEFAULT;
	}
	
	get shapeSheet():ShapeSheet { return this._shapeSheet; }
	get renderer():ShapeSheetRenderer|undefined { return this._renderer; }
	
	// TODO: Mind plotMode
	protected plotPixel(x:number, y:number, z0:number, z1:number, z2:number, z3:number, materialIndex?:number):void {
		var ss = this.shapeSheet;
		x = x|0;
		y = y|0;
		if( x < 0 ) return;
		if( y < 0 ) return;
		const width = ss.width;
		const cellMaterialIndexes = ss.cellMaterialIndexes;
		const cellCornerDepths = ss.cellCornerDepths;
		if( x >= width ) return;
		if( y >= ss.height ) return;
		
		if( this.plottedDepthFunction !== NOOP_PLOTTED_DEPTH_FUNCTION ) {
			z0 = this.plottedDepthFunction(x+0, y+0, z0);
			z1 = this.plottedDepthFunction(x+1, y+0, z1);
			z2 = this.plottedDepthFunction(x+0, y+1, z2);
			z3 = this.plottedDepthFunction(x+1, y+1, z3);
		}
		
		if( materialIndex == null ) {
			let avgZ = 0;
			let nonInfinityCorners = 0;
			if( z0 != Infinity ) { avgZ += z0; ++nonInfinityCorners; }
			if( z1 != Infinity ) { avgZ += z1; ++nonInfinityCorners; }
			if( z2 != Infinity ) { avgZ += z2; ++nonInfinityCorners; }
			if( z3 != Infinity ) { avgZ += z3; ++nonInfinityCorners; }
			avgZ = nonInfinityCorners == 0 ? Infinity : avgZ/nonInfinityCorners;
			materialIndex = (this.plottedMaterialIndexFunction)(x,y,avgZ,z0,z1,z2,z3);
		}
		
		const
			idx = x + y*width,
			oldZ0 = cellCornerDepths[idx*4+0],
			oldZ1 = cellCornerDepths[idx*4+1],
			oldZ2 = cellCornerDepths[idx*4+2],
			oldZ3 = cellCornerDepths[idx*4+3];
		
		const frontness =
			((z0 < oldZ0) ? 1 : 0) +
			((z1 < oldZ1) ? 1 : 0) +
			((z2 < oldZ2) ? 1 : 0) +
			((z3 < oldZ3) ? 1 : 0);

		/*
		if( z0 <= oldZ0 ) cellCornerDepths[idx*4+0] = z0;
		if( z1 <= oldZ1 ) cellCornerDepths[idx*4+1] = z1;
		if( z2 <= oldZ2 ) cellCornerDepths[idx*4+2] = z2;
		if( z3 <= oldZ3 ) cellCornerDepths[idx*4+3] = z3;
		
		const ox =
			infiniMinus(z0, oldZ0) +
			infiniMinus(z1, oldZ1) +
			infiniMinus(z2, oldZ2) +
			infiniMinus(z3, oldZ3);
		*/
		const minZ = Math.min(z0, z1, z2, z3);
		const oldMinZ = Math.min(oldZ0, oldZ1, oldZ2, oldZ3);
		if( materialIndex && frontness >= 2 ) {
			// Then our new thing is on average in front of the old thing
			if( cellMaterialIndexes[idx] == materialIndex ) {
				// 'weld'
				cellCornerDepths[idx*4+0] = Math.min(z0, oldZ0);
				cellCornerDepths[idx*4+1] = Math.min(z1, oldZ1);
				cellCornerDepths[idx*4+2] = Math.min(z2, oldZ2);
				cellCornerDepths[idx*4+3] = Math.min(z3, oldZ3);
			} else {
				// replace
				cellMaterialIndexes[idx] = materialIndex;
				cellCornerDepths[idx*4+0] = z0;
				cellCornerDepths[idx*4+1] = z1;
				cellCornerDepths[idx*4+2] = z2;
				cellCornerDepths[idx*4+3] = z3;
			}
		}
	};
	
	protected dataUpdated(rect:Rectangle) {
		if( this.renderer ) this.renderer.dataUpdated(rect, true, true);
	}
	
	clear() {
		this.shapeSheet.initBuffer();
		this.dataUpdated(this.shapeSheet.bounds);
	}
	
	/** Shift the Z of every cell by this amount. */
	shiftZ(diff:number):void {
		var ss = this.shapeSheet;
		var i:number;
		var cellCornerDepths = ss.cellCornerDepths;
		
		for( i=ss.width*ss.height*4-1; i>=0; --i ) {
			cellCornerDepths[i] += diff;
		}
		if( this.renderer ) {
			var cellAverageDepths = this.renderer.cellAverageDepths;
			for( i=ss.width*ss.height-1; i>=0; --i ) {
				cellAverageDepths[i] += diff;
			}
		}
		if( this.renderer && this.renderer.shaders.length > 0 ) {
			this.renderer.dataUpdated(this._shapeSheet.bounds, false, true);
		}
	};
	
	plotFlatTBQuad(y0:number, y2:number, x0:number, z0:number, x1:number, z1:number, x2:number, z2:number, x3:number, z3:number):void {
		// Points: ____
		//      0 /    \ 1
		//       /      \
		//      /        \
		//   2 /__________\ 3
		// 
		// e.g. y0 = 0.5, y2 = 2, x0 = x1 = 2.5, x2 = 1, x3 = 5
		//
		//    0        1        2   2.5  3        4        5        6        7
		// 0  +--------+--------+--------+--------+--------+--------+--------+
		//    |        |        |        |        |        |        |        |
		// 0.5|        |        |    ._  |        |        |        |        |
		//    |        |        |  _/  \_|_       |        |        |        |
		//    |        |        |_/      | \__    |        |        |        |
		// 1  +--------+--------x--------x--------+--------+--------+--------+
		//    |        |      _/|        |    \__ |        |        |        |
		//    |        |    _/  |        |       \|__      |        |        |
		//    |        |  _/    |        |        |  \__   |        |        |
		//    |        |_/      |        |        |     \__|        |        |
		// 2  +--------x--------x--------x--------x--------x--------+--------+
		
		var ss = this._shapeSheet;
		
		const minY = Math.max(0,Math.round(y0))|0;
		const maxY = Math.min(ss.height,Math.round(y2))|0;
		if( minY >= maxY ) return;
		
		var cellCornerDepths = ss.cellCornerDepths;
		var cellMaterialIndexes = ss.cellMaterialIndexes;
		var ssWidth = ss.width;
		
		if( x1 <= x0 && x3 <= x2 ) return;
		if( y0 >= y2 ) return;
		
		const height = y2-y0;
		
		// Figure out surface angle so we never have to do it again
		// (also, calculating it only once will ensure that our polygon appears flat)
		const dzdx = (x1 - x0) > (x3 - x2) ? (z1-z0)/(x1-x0) : (z3-z2)/(x3-x2);
		const dzdy = ((z2 + dzdx*(x0-x2)) - z0) / (y2-y0);
		
		const diffY  = y2-y0;
		const diffX0 = x2-x0, diffX1 = x3-x1;
		const diffZ0 = z2-z0, diffZ1 = z3-z1;
		
		const rowCount = maxY-minY;
		
		for( let y=minY; y<maxY; ++y ) {
			const midYRat = (y+0.5-y0)/diffY;
			const minX = Math.max(0, Math.round( x0 + diffX0*midYRat ))|0;
			const maxX = Math.min(ss.width, Math.round( x1 + diffX1*midYRat ));
			for( let x=minX; x<maxX; ++x ) {
				const pz0 = z0 + (x-x0)*dzdx + (y-y0)*dzdy;
				this.plotPixel( x, y, pz0, pz0+dzdx, pz0+dzdy, pz0+dzdx+dzdy );
			}
		}
		
		var boundingBoxX0 = Math.min(x0, x2)|0, boundingBoxX1 = Math.ceil(Math.max(x1,x3))|0;
		
		this.dataUpdated(new Rectangle(boundingBoxX0, minY, boundingBoxX1, maxY));
	};
	
	/**
	 * If the fingers of your left hand wrap around a polygon (i.e. clockwise)
	 * the un-normalized vector of your left thumb has this Z component
	 * 
	 * (negative Z being out of the screen, positive being into it)
	 * 
	 * @param {Array<number>} points [x0, y0, z0, x1, y1, z1 .... xN, yN, zN]
	 * @return a positive or negative number indicating the Z of the polygon's normal vector
	 */
	leftThumbZ = function( points:Array<number> ):number {
		var normalX=0, normalY=0, normalZ=0;
		var i:number, j:number;
		var vertexCount = points.length/3;
		for( i=0, j=1; i < vertexCount; ++i, ++j ) {
			if( j == vertexCount ) j = 0;
			normalX += (points[i*3+2] + points[j*3+2]) * (points[j*3+1] - points[i*3+1]);
			normalY += (points[i*3+0] + points[j*3+0]) * (points[j*3+2] - points[i*3+2]);
			normalZ += (points[i*3+1] + points[j*3+1]) * (points[j*3+0] - points[i*3+0]);
		}
		return normalZ;
	};
	
	public blit( sss:ShapeSheet, sx0:number, sy0:number, w:number, h:number, dx0:number, dy0:number, dz:number ) {
		const dss = this.shapeSheet;
		sx0 = Math.round(sx0)|0;
		sy0 = Math.round(sy0)|0;
		dx0 = Math.round(dx0)|0;
		dy0 = Math.round(dy0)|0;
		const minDx = Math.max(dx0-sx0, Math.max(0, dx0));
		const minDy = Math.max(dy0-sx0, Math.max(0, dy0));
		const maxDx = Math.min(dx0+sss.width -sx0, Math.min(dss.width , dx0+w));
		const maxDy = Math.min(dy0+sss.height-sy0, Math.min(dss.height, dy0+h));
		
		const sMI  = sss.cellMaterialIndexes;
		const sCCD = sss.cellCornerDepths;
		const dMI  = dss.cellMaterialIndexes;
		const dCCD = dss.cellCornerDepths;
		const plotMode = this.plotMode;
		
		for( let dy=minDy, sy=dy+(sy0-dy0); dy < maxDy; ++dy, ++sy ) for( let dx=minDx, sx=dx+(sx0-dx0), di=dx+dss.width*dy, si=sx+sss.width*sy; dx < maxDx; ++dx, ++di, ++si ) {
			// I expect it would benefit speed a lot to inline this, but that would be a pain.
			// So don't do it unless you really need to.
			this.plotPixel( dx, dy, dz+sCCD[si*4+0], dz+sCCD[si*4+1], dz+sCCD[si*4+2], dz+sCCD[si*4+3], sMI[si] );
		}
		
		this.dataUpdated(new Rectangle(minDx, minDy, maxDx, maxDy));
	}
	
	/**
	 * Modifies points array in-place to snap all points to the nearest whatever
	 * 
	 * @param {Array<number>} points [x0, y0, z0, x1, y1, z1 .... xN, yN, zN]
	 */
	snapPoints( points:Array<number>, xFrac?:number, yFrac?:number, zFrac?:number ):void {
		if( xFrac == null ) xFrac = 8;
		if( yFrac == null ) yFrac = 8;
		if( zFrac == null ) zFrac = 16;
		var vertexCount = points.length/3;
		var i:number;
		const snap = function(v:number, frac:number):number {
			return Math.round(v * frac) / frac;
		};
		for( i=0; i < vertexCount; ++i ) {
			points[i*3+0] = snap(points[i*3+0], xFrac);
			points[i*3+1] = snap(points[i*3+1], yFrac);
			points[i*3+2] = snap(points[i*3+2], zFrac);
		}
	};
	
	plotConvexPolygon( points:Array<number>, drawBackside:boolean=false ):void {
		var normalZ = this.leftThumbZ(points);
		if( normalZ > 0 ) {
			if( drawBackside ) points = reversePointList(points);
			else return;
		}
		
		var vertexCount = points.length/3;
		var topY = Infinity, bottomY = -Infinity;
		var topIndex = 0, bottomIndex = 0;
		var i:number;
		for( i=0; i<vertexCount; ++i ) {
			var y = points[i*3+1];
			if( y < topY    ) { topY    = y; topIndex    = i; }
			if( y > bottomY ) { bottomY = y; bottomIndex = i; }
		}
		// From the top to the bottom, draw thing.
		var sectTopIndex = topIndex, leftIndex = topIndex, rightIndex = topIndex;
		y = points[topIndex*3+1];
		var rightX = points[topIndex*3+0], rightZ = points[topIndex*3+2];
		var leftX = rightX, leftZ = rightZ;
		var nextY:number, nextRightX:number, nextRightZ:number, nextLeftX:number, nextLeftZ:number;
		while( leftIndex != bottomIndex ) {
			var nextLeftIndex = leftIndex-1;
			if( nextLeftIndex < 0 ) nextLeftIndex += vertexCount;
			var nextRightIndex = rightIndex+1;
			if( nextRightIndex >= vertexCount ) nextRightIndex -= vertexCount;
			
			var moveLeft:boolean, moveRight:boolean, moveRat:number;
			
			if( (nextY = points[nextRightIndex*3+1]) == points[nextLeftIndex*3+1] ) {
				moveLeft = moveRight = true;
			} else if( (nextY = points[nextRightIndex*3+1]) < points[nextLeftIndex*3+1] ) {
				nextY = points[nextRightIndex*3+1];
				moveRight = true; moveLeft = false;
			} else {
				nextY = points[nextLeftIndex*3+1];
				moveLeft = true; moveRight = false;
			}
			if( moveRight ) {
				nextRightX = points[nextRightIndex*3+0];
				nextRightZ = points[nextRightIndex*3+2];
			} else {
				moveRat = (nextY-y)/(points[nextRightIndex*3+1]-y);
				nextRightX = rightX + moveRat*(points[nextRightIndex*3+0]-rightX);
				nextRightZ = rightZ + moveRat*(points[nextRightIndex*3+2]-rightZ);
			}
			if( moveLeft ) {
				nextLeftX  = points[nextLeftIndex*3+0];
				nextLeftZ  = points[nextLeftIndex*3+2];
			} else {
				moveRat = (nextY-y)/(points[nextLeftIndex*3+1]-y);
				nextLeftX = leftX + moveRat*(points[nextLeftIndex*3+0]-leftX);
				nextLeftZ = leftZ + moveRat*(points[nextLeftIndex*3+2]-leftZ);
			}
			
			this.plotFlatTBQuad(y, nextY, leftX, leftZ, rightX, rightZ, nextLeftX, nextLeftZ, nextRightX, nextRightZ);
			if( moveLeft  ) leftIndex  = nextLeftIndex;
			if( moveRight ) rightIndex = nextRightIndex;
			y = nextY;
			rightX = nextRightX;	rightZ = nextRightZ;
			leftX =  nextLeftX;  leftZ =  nextLeftZ;
		}
	};
	
	plotAABeveledCuboid( x:number, y:number, z:number, w:number, h:number, bevelDepth:number ):void {
		var x0 = x, x1=x+bevelDepth, x2=x+w-bevelDepth, x3=x+w;
		var y0 = y, y1=y+bevelDepth, y2=y+h-bevelDepth, y3=y+h;
		var z0 = z, z1 = z+bevelDepth;

		this.plotFlatTBQuad( y0, y1, x1,z1, x1,z1, x0,z1, x1,z0 ); // top left
		this.plotFlatTBQuad( y0, y1, x1,z1, x2,z1, x1,z0, x2,z0 ); // top
		this.plotFlatTBQuad( y0, y1, x2,z1, x2,z1, x2,z0, x3,z1 ); // top right
		this.plotFlatTBQuad( y1, y2, x0,z1, x1,z0, x0,z1, x1,z0 ); // left
		this.plotFlatTBQuad( y1, y2, x1,z0, x2,z0, x1,z0, x2,z0 ); // middle
		this.plotFlatTBQuad( y1, y2, x2,z0, x3,z1, x2,z0, x3,z1 ); // right
		this.plotFlatTBQuad( y2, y3, x0,z1, x1,z0, x1,z1, x1,z1 ); // bottom left
		this.plotFlatTBQuad( y2, y3, x1,z0, x2,z0, x1,z1, x2,z1 ); // bottom
		this.plotFlatTBQuad( y2, y3, x2,z0, x3,z1, x2,z1, x2,z1 ); // bottom right
	};

	plotAASharpBeveledCuboid( x:number, y:number, z:number, w:number, h:number, bevelDepth:number ):void {
		var x0 = x, x1=x+bevelDepth, x2=x+w-bevelDepth, x3=x+w;
		var y0 = y, y1=y+bevelDepth, y2=y+h-bevelDepth, y3=y+h;
		var z0 = z, z1 = z+bevelDepth;
		
		this.plotConvexPolygon( [x0,y0,z1, x3,y0,z1, x2,y1,z0, x1,y1,z0] ); // top
		this.plotConvexPolygon( [x0,y0,z1, x1,y1,z0, x1,y2,z0, x0,y3,z1] ); // left
		this.plotConvexPolygon( [x1,y1,z0, x2,y1,z0, x2,y2,z0, x1,y2,z0] ); // middle
		this.plotConvexPolygon( [x2,y1,z0, x3,y0,z1, x3,y3,z1, x2,y2,z0] ); // right
		this.plotConvexPolygon( [x1,y2,z0, x2,y2,z0, x3,y3,z1, x0,y3,z1] ); // bottom
	};

	plotSphere(centerX:number, centerY:number, centerZ:number, rad:number):void {
		var i:void;
		var sphereDepth = function(x:number,y:number):number {
			var sphereX = (x - centerX) / rad;
			var sphereY = (y - centerY) / rad;
			var d = sphereX*sphereX + sphereY*sphereY;
			if( d >  1 ) return Infinity;
			if( d == 1 ) return centerZ;
			
			// z*z + x*x + y*y = 1
			// z*z = 1 - (x*x + y*y)
			// z = Math.sqrt(1 - (x*x+y*y))
			
			return centerZ - rad * Math.sqrt(1 - d);
		};
		
		const boundingRect:Rectangle = Rectangle.intersection(
			new Rectangle(centerX-rad, centerY-rad, centerX+rad, centerY+rad),
			this.shapeSheet.bounds
		).growToIntegerBoundaries();
		
		for( let y = boundingRect.minY; y < boundingRect.maxY; ++y ) {
			for( let x = boundingRect.minX; x < boundingRect.maxX; ++x ) {
				let z0 = sphereDepth(x+0,y+0);
				let z1 = sphereDepth(x+1,y+0);
				let z2 = sphereDepth(x+0,y+1);
				let z3 = sphereDepth(x+1,y+1);
				// If a whole side is missing, don't try to render it.
				if( z0 == Infinity && z1 == Infinity ) continue;
				if( z2 == Infinity && z3 == Infinity ) continue;
				if( z0 == Infinity && z2 == Infinity ) continue;
				if( z1 == Infinity && z3 == Infinity ) continue;
				
				// Otherwise it's just, like, one corner,
				// so extrapolate from the other corners.
				if( z0 == Infinity ) z0 = (z1 + (z1-z3) + z2 + (z2-z3))/2;
				if( z1 == Infinity ) z1 = (z0 + (z0-z2) + z3 + (z3-z2))/2;
				if( z2 == Infinity ) z2 = (z3 + (z3-z1) + z0 + (z0-z1))/2;
				if( z3 == Infinity ) z3 = (z2 + (z2-z0) + z1 + (z1-z0))/2;
				
				this.plotPixel(
					x, y, z0, z1, z2, z3
				);
			}
		}
		this.dataUpdated(boundingRect);
	};
	
	plotLine( x0:number, y0:number, z0:number, r0:number, x1:number, y1:number, z1:number, r1:number, plotFunc?:PlotFunction ) {
		if( !plotFunc ) plotFunc = this.plotSphere;
		
		if( x0 == x1 && y0 == y1 ) {
			var z = Math.min(z0, z1);
			plotFunc.call( this, x0, y0, z, Math.max(r0, r1) );
			return;
		}
		
		const vect = new Vector3D(x1-x0, y1-y0, z1-z0);
		const stepVect = normalizeVect3dToXYUnitSquare(vect);
		const stepCount = vect.length / stepVect.length;
		const stepR = (r1-r0)/stepCount;
		for( let i=0; i <= stepCount; ++i ) {
			plotFunc.call( this, x0+stepVect.x*i, y0+stepVect.y*i, z0+stepVect.z*i, r0+stepR*i );
		}
	};
	
	protected _plotCurveSegment( curve:Curve, r0:number, r1:number, t0:number, t1:number, plotFunc:PlotFunction, v:Vector3DBuffer ):void {
		var x0:number, y0:number, z0:number, x1:number, y1:number, z1:number, x2:number, y2:number, z2:number;
		curve( t0          , v ); x0 = v.x; y0 = v.y; z0 = v.z;
		curve( t0+(t1-t0)/2, v ); x1 = v.x; y1 = v.y; z1 = v.z;
		curve( t1          , v ); x2 = v.x; y2 = v.y; z2 = v.z;
		
		plotFunc.call( this, x0, y0, z0, r0+t0*(r1-r0) );
		var maxDist = Math.max(disto(x0,y0,z0, x1,y1,z1), Math.max(disto(x0,y0,z0, x2,y2,z2)));
		if( maxDist >= 0.5 ) { // TODO: should probably depend on r
			// Subdivide!
			this._plotCurveSegment( curve, r0, r1, t0, t0+(t1-t0)/2, plotFunc, v );
			this._plotCurveSegment( curve, r0, r1, t0+(t1-t0)/2, t1, plotFunc, v );
		}
	};
	
	plotCurve( curve:Curve, r0:number, r1:number, plotFunc:PlotFunction ):void {
		if( plotFunc == null ) plotFunc = this.plotSphere;
		
		var v = new Vector3D;
		curve( 1, v );
		plotFunc.call( this, v.x, v.y, v.z, r1 );
		this._plotCurveSegment( curve, r0, r1, 0, 1, plotFunc, v );
	};
	
	plotDensityFunction( df:DensityFunction3D, boundingCuboid:Cuboid, maxIterations:number=10 ):void {
		// TODO: Support transformations somehow so the function doesn't have to do it?
		// Will also want to support those for depth and material plotting functions...
		const minX = Math.floor(boundingCuboid.minX)|0;
		const minY = Math.floor(boundingCuboid.minY)|0;
		const maxX = Math.ceil(boundingCuboid.maxX)|0;
		const maxY = Math.ceil(boundingCuboid.maxY)|0;
		const minZ = boundingCuboid.minZ;
		const maxZ = boundingCuboid.maxZ;
		const cornerDepths = new Float32Array(4*maxX-minX);
		let z0:number, z1:number, z2:number, z3:number;
		for( let y=minY; y<maxY; ++y ) {
			z0 = findSurfaceZ(df, minX+0, y+0, minZ, maxZ, maxIterations);
			z2 = findSurfaceZ(df, minX+0, y+1, minZ, maxZ, maxIterations);
			for( let x=minX; x<maxX; ++x ) {
				z1 = findSurfaceZ(df, x+1, y+0, minZ, maxZ, maxIterations);
				z3 = findSurfaceZ(df, x+1, y+1, minZ, maxZ, maxIterations);
				
				this.plotPixel(x, y, z0, z1, z2, z3);
				
				z0 = z1;
				z2 = z3;
			}
		}
		this.dataUpdated(new Rectangle(minX, minY, maxX, maxY));
	}
	
	//// Cropping functions
	
	public static findAutocrop( ss:ShapeSheet, bounds:Rectangle ):Rectangle {
		const minX = Math.ceil(bounds.minX)|0;
		const minY = Math.ceil(bounds.minY)|0;
		const maxX = Math.ceil(bounds.maxX)|0;
		const maxY = Math.ceil(bounds.maxY)|0;
		
		let opaqueMinX = +Infinity;
		let opaqueMinY = +Infinity;
		let opaqueMaxX = -Infinity;
		let opaqueMaxY = -Infinity;
		
		const cellCornerDepths = ss.cellCornerDepths;
		
		for( let y=minY; y < maxY; ++y ) {
			for( let x=minX, i=x+ss.width*y; x < maxX; ++x, ++i ) {
				if(
					cellCornerDepths[i*4+0] != Infinity ||
					cellCornerDepths[i*4+1] != Infinity ||
					cellCornerDepths[i*4+2] != Infinity ||
					cellCornerDepths[i*4+3] != Infinity
				) {
					opaqueMinX = Math.min(opaqueMinX, x  );
					opaqueMaxX = Math.max(opaqueMaxX, x+1);
					opaqueMinY = Math.min(opaqueMinY, y  );
					opaqueMaxY = Math.max(opaqueMaxY, y+1);
				}
			}
		}
		
		return new Rectangle(opaqueMinX, opaqueMinY, opaqueMaxX, opaqueMaxY);
	}
	
	public static crop( sss:ImageSlice<ShapeSheet>, cropRect:Rectangle, newSheet:boolean ):ImageSlice<ShapeSheet> {
		if( newSheet ) {
			const croppedSs = new ShapeSheet(cropRect.width, cropRect.height);
			const ssu = new ShapeSheetUtil(croppedSs);
			ssu.blit( sss.sheet, cropRect.minX, cropRect.minY, cropRect.width, cropRect.height, 0, 0, 0 );
			return new ImageSlice<ShapeSheet>(
				croppedSs,
				new Vector3D(sss.origin.x - cropRect.minX, sss.origin.y - cropRect.minY, sss.origin.z),
				sss.resolution,
				new Rectangle(0,0,cropRect.width,cropRect.height))
		}
		
		return new ImageSlice<ShapeSheet>( sss.sheet, sss.origin, sss.resolution, cropRect );
	}
	
	public static autocrop( sss:ImageSlice<ShapeSheet>, newSheet:boolean=false, gridSize:number=1 ):ImageSlice<ShapeSheet> {
		const cropRect:Rectangle = this.findAutocrop(sss.sheet, sss.bounds).scale(1/gridSize).growToIntegerBoundaries().scale(gridSize).toNonNegativeRectangle();
		if( Rectangle.areEqual(sss.bounds, cropRect) ) return sss;
		
		return this.crop(sss, cropRect, newSheet);
	}
	
	public static proceduralShapeToShapeSheet( ps:ProceduralShape, orientation:Quaternion, resolution:number ):ImageSlice<ShapeSheet> {
		const xf = TransformationMatrix3D.fromQuaternion(orientation).multiply(TransformationMatrix3D.scale(resolution));
		const bounds = ps.estimateOuterBounds(0.5, xf).growToIntegerBoundaries();
		const origin:Vector3D = new Vector3D(
			-bounds.minX,
			-bounds.minY,
			0);
		const ss = new ShapeSheet(bounds.width, bounds.height);
		const ssu = new ShapeSheetUtil(ss);
		ps.draw( ssu, 0.5, TransformationMatrix3D.translation(origin).multiply(xf) );
		return this.autocrop(new ImageSlice<ShapeSheet>(ss, origin, resolution, ss.bounds), true);
	}
};

export default ShapeSheetUtil;
