import Vector3D from './Vector3D';
import Curve from './Curve';
import {makeCubicBezierCurve} from './Bezier';
import ShapeSheet from './ShapeSheet';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil from './ShapeSheetUtil';
import SurfaceColor from './SurfaceColor';
import TransformationMatrix3D from './TransformationMatrix3D';
import Quaternion from './Quaternion';

class TrackEndpoint {
	public position:Vector3D;
	public orientation:Quaternion;
}
class TrackTypeRail {
	public materialIndex:number;
	public offset:Vector3D; // Offset when forward = +x and up = -z
	public radius:number;
}
class TrackType {
	public rails:Array<TrackTypeRail>;
}

const addVect3d = function( v0:Vector3D, v1:Vector3D ):Vector3D {
	return new Vector3D(v0.x+v1.x, v0.y+v1.y, v0.z+v1.z);
};
const subtractVect3d = function( v0:Vector3D, v1:Vector3D ) {
	return new Vector3D(v0.x-v1.x, v0.y-v1.y, v0.z-v1.z);
};

function railEndpoint( trackEndpoint:TrackEndpoint, rail:TrackTypeRail ):TrackEndpoint {
	const pos:Vector3D = trackEndpoint.position;
	const xform = TransformationMatrix3D.IDENTITY.
		multiply(TransformationMatrix3D.translation(trackEndpoint.position)).
		multiply(TransformationMatrix3D.fromQuaternion(trackEndpoint.orientation));
	return {
		position: xform.multiplyVector(rail.offset),
		orientation: trackEndpoint.orientation
	};  
}

function trackCurve( start:TrackEndpoint, end:TrackEndpoint ):Curve {
	const startForward = TransformationMatrix3D.fromQuaternion(start.orientation).multiplyVector(Vector3D.I); 
	const endForward = TransformationMatrix3D.fromQuaternion(end.orientation).multiplyVector(Vector3D.I);
	return makeCubicBezierCurve(
		start.position, addVect3d(start.position, startForward),
		subtractVect3d(end.position, endForward), end.position
	);
}

export default class RailDemo {
	protected shapeSheetUtil:ShapeSheetUtil;
	constructor(util:ShapeSheetUtil) {
		this.shapeSheetUtil = util;
	}
	
	drawRail(trackType:TrackType, start:TrackEndpoint, end:TrackEndpoint) {
		for( let r in trackType.rails ) {
			const rail = trackType.rails[r];
			const railStart = railEndpoint(start, rail);
			const railEnd   = railEndpoint(end  , rail);
			const railCurve = trackCurve(railStart, railEnd);
			this.shapeSheetUtil.plottedMaterialIndexFunction = function() { return rail.materialIndex; };
			this.shapeSheetUtil.plotCurve(railCurve, rail.radius, rail.radius, this.shapeSheetUtil.plotSphere);
		}
		
		const curve = trackCurve(start, end);
		this.shapeSheetUtil.plottedMaterialIndexFunction = function() { return 8; };
		this.shapeSheetUtil.plotCurve(curve, 2, 2, this.shapeSheetUtil.plotSphere);
	}
	
	run():void {
		const scale = 16;
		
		const minusZ = new Vector3D(0,0,-1);
		
		const trackStart:TrackEndpoint = {
			position: new Vector3D(scale*1, scale*8, 0),
			orientation: Quaternion.fromXYZAxisAngle(0,0,1,-Math.PI/2)
		};
		const trackEnd:TrackEndpoint = {
			position: new Vector3D(scale*3, scale*3, 0),
			orientation: Quaternion.fromXYZAxisAngle(0,0,1,-Math.PI/4)
		};
		
		const leftRail:TrackTypeRail = {
			offset: new Vector3D(0, -scale*2/3, 0),
			materialIndex: 4,
			radius: scale/8
		};
		const rightRail:TrackTypeRail = {
			offset: new Vector3D(0, +scale*2/3, 0),
			materialIndex: 4,
			radius: scale/8
		};
		const trackType:TrackType = {
			rails: [ leftRail, rightRail ]
		};
		
		this.drawRail(trackType, trackStart, trackEnd);
		this.shapeSheetUtil.renderer.requestCanvasUpdate();
		console.log("Rail demo...");
	}
}

export function runDemo() {
	var canv = <HTMLCanvasElement>document.getElementById('shaded-preview-canvas');
	
	var shapeSheet = new ShapeSheet(canv.width, canv.height);
	var shapeSheetRenderer = new ShapeSheetRenderer(shapeSheet, canv);
	shapeSheetRenderer.shaders.push(ShapeSheetRenderer.makeFogShader(0, new SurfaceColor(0, 0, 0, 0.01)));
	var shapeSheetUtil = new ShapeSheetUtil(shapeSheet, shapeSheetRenderer);
	var railDemo = new RailDemo(shapeSheetUtil);
	railDemo.run();
}
