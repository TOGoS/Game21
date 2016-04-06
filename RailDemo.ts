import Vector3D from './Vector3D';
import Curve, {estimateCurveLength, estimateCurveTangent} from './Curve';
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



function guessCurve( c:Curve, startDir:Vector3D, endDir:Vector3D ):Curve {
	const b0=new Vector3D
	const b3=new Vector3D
	c(0.00, b0);
	c(1.00, b3);
	
	const len = estimateCurveLength(c);
	// len / 3 seems to allow for nice 45 degree curves
	const b1 = Vector3D.add( b0, startDir.normalize(+len/3) );
	const b2 = Vector3D.add( b3,   endDir.normalize(-len/3) );
	
	return makeCubicBezierCurve(b0, b1, b2, b3);
}

function trackCurve( start:TrackEndpoint, end:TrackEndpoint, iter:number=1 ):Curve {
	const startForward = TransformationMatrix3D.fromQuaternion(start.orientation).multiplyVector(Vector3D.I); 
	const endForward   = TransformationMatrix3D.fromQuaternion(end.orientation  ).multiplyVector(Vector3D.I);
	
	let curve = makeCubicBezierCurve(start.position, start.position, end.position, end.position);
	for( let i=0; i<iter; ++i ) {
		curve = guessCurve(curve, startForward, endForward);
	}
	
	return curve;
}

export default class RailDemo {
	protected shapeSheetUtil:ShapeSheetUtil;
	constructor(util:ShapeSheetUtil) {
		this.shapeSheetUtil = util;
	}
	
	protected _drawRails(rails:Array<TrackTypeRail>, startOrientation:Quaternion, endOrientation:Quaternion, trackCurve:Curve, divisions:number=16) {
		let prevTrackPosition:Vector3D = new Vector3D;
		let nextTrackPosition:Vector3D = new Vector3D;
		let prevRailPosition:Vector3D = new Vector3D;
		let nextRailPosition:Vector3D = new Vector3D;
		let prevOrientation:Quaternion = new Quaternion;
		let nextOrientation:Quaternion = new Quaternion;
		let prevTransform = new TransformationMatrix3D;
		let nextTransform = new TransformationMatrix3D;
		trackCurve(0, prevTrackPosition);
		Quaternion.slerp(startOrientation, endOrientation, 0, true, prevOrientation);
		TransformationMatrix3D.fromQuaternion(prevOrientation, prevTransform);
		prevTransform.x1 = prevTrackPosition.x;
		prevTransform.y1 = prevTrackPosition.y;
		prevTransform.z1 = prevTrackPosition.z;
		for( let i=1; i <= divisions; ++i ) {
			const nextT = i/divisions;
			trackCurve(nextT, nextTrackPosition);
			Quaternion.slerp(startOrientation, endOrientation, nextT, true, nextOrientation);
			TransformationMatrix3D.fromQuaternion(nextOrientation, nextTransform);
			nextTransform.x1 = nextTrackPosition.x;
			nextTransform.y1 = nextTrackPosition.y;
			nextTransform.z1 = nextTrackPosition.z;
			for( let r in rails ) {
				let rail = rails[r];
				prevTransform.multiplyVector(rail.offset, prevRailPosition);
				nextTransform.multiplyVector(rail.offset, nextRailPosition);
				this.shapeSheetUtil.plotLine(
					prevRailPosition.x, prevRailPosition.y, prevRailPosition.z, rail.radius,
					nextRailPosition.x, nextRailPosition.y, nextRailPosition.z, rail.radius,
					null
				)
			}
			let tempTransform     = prevTransform    ; prevTransform     = nextTransform    ; nextTransform     = tempTransform    ;
			let tempOrientation   = prevOrientation  ; prevOrientation   = nextOrientation  ; nextOrientation   = tempOrientation  ;
			let tempTrackPosition = prevTrackPosition; prevTrackPosition = nextTrackPosition; nextTrackPosition = tempTrackPosition;
		}
	}
	
	drawTrack(trackType:TrackType, start:TrackEndpoint, end:TrackEndpoint) {
		const curve = trackCurve(start, end);
		const buf = new Vector3D;
		
		this._drawRails(trackType.rails, start.orientation, end.orientation, curve, 16);
		/*
		for( let r in trackType.rails ) {
			const rail = trackType.rails[r];
			/+
			const railStart = railEndpoint(start, rail);
			const railEnd   = railEndpoint(end  , rail);
			const railCurve = trackCurve(railStart, railEnd);
			this.shapeSheetUtil.plottedMaterialIndexFunction = function() { return rail.materialIndex; };
			this.shapeSheetUtil.plotCurve(railCurve, rail.radius, rail.radius, this.shapeSheetUtil.plotSphere);
			+/
		}
		*/
		
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
		
		this.drawTrack(trackType, trackStart, trackEnd);
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
