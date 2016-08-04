import Vector3D from './Vector3D';
import Curve, {estimateCurveLength, estimateCurveTangent} from './Curve';
import {makeCubicBezierCurve} from './Bezier';
import ShapeSheet from './ShapeSheet';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil, {PlottedMaterialIndexFunction, PlottedDepthFunction, NOOP_PLOTTED_DEPTH_FUNCTION, constantMaterialIndexFunction} from './ShapeSheetUtil';
import SurfaceColor from './SurfaceColor';
import TransformationMatrix3D from './TransformationMatrix3D';
import Quaternion from './Quaternion';

class TrackEndpoint {
	public position:Vector3D;
	public orientation:Quaternion;
}
class TrackTypeRail {
	public surfaceDepthFunction:PlottedDepthFunction;
	public surfaceMaterialIndexFunction:PlottedMaterialIndexFunction;
	public offset:Vector3D; // Offset when forward = +x and up = -z
	public radius:number;
}

enum TiePattern {
	Perpendicular,     //  | | | | |
	Zig          ,     //   \ \ \ \
	ZigZag       ,     //   \ / \ / 
}

class TrackTypeTie {
	public surfaceDepthFunction:PlottedDepthFunction;
	public surfaceMaterialIndexFunction:PlottedMaterialIndexFunction;
	public pattern:TiePattern;
	public spacing:number; // Distance between ties
	public y0:number;
	public y1:number;
	public radius:number;
}
class TrackType {
	public rails:Array<TrackTypeRail>;
	public ties:Array<TrackTypeTie>;
	// Might eventually want a way to add arbitrary other stuff
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
	public scale:number;
	protected shapeSheetUtil:ShapeSheetUtil;
	constructor(util:ShapeSheetUtil) {
		this.shapeSheetUtil = util;
	}
	
	protected _drawTrackSegmentRails(
		rails:Array<TrackTypeRail>, startOrientation:Quaternion, endOrientation:Quaternion, trackCurve:Curve, divisions:number=16
	) {
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
				this.shapeSheetUtil.plottedDepthFunction = rail.surfaceDepthFunction;
				this.shapeSheetUtil.plottedMaterialIndexFunction = rail.surfaceMaterialIndexFunction;
				this.shapeSheetUtil.plotLine(
					prevRailPosition.x, prevRailPosition.y, prevRailPosition.z, rail.radius,
					nextRailPosition.x, nextRailPosition.y, nextRailPosition.z, rail.radius
				)
			}
			let tempTransform     = prevTransform    ; prevTransform     = nextTransform    ; nextTransform     = tempTransform    ;
			let tempOrientation   = prevOrientation  ; prevOrientation   = nextOrientation  ; nextOrientation   = tempOrientation  ;
			let tempTrackPosition = prevTrackPosition; prevTrackPosition = nextTrackPosition; nextTrackPosition = tempTrackPosition;
		}
	}
	
	protected _drawTrackSegmentTies(tie:TrackTypeTie, startOrientation:Quaternion, endOrientation:Quaternion, trackCurve:Curve) {
		const segmentLength = estimateCurveLength(trackCurve);
		const divisions = Math.round( segmentLength / tie.spacing );
		
		const leftOffset  = new Vector3D(0, tie.y0, 0);
		const rightOffset = new Vector3D(0, tie.y1, 0);
		
		let prevTrackPosition:Vector3D = new Vector3D;
		let nextTrackPosition:Vector3D = new Vector3D;
		// Sub-segment corner positions
		//let c0rPosition:Vector3D = new Vector3D;
		//let c0lPosition:Vector3D = new Vector3D;
		//let c1rPosition:Vector3D = new Vector3D;
		//let c1lPosition:Vector3D = new Vector3D;
		let tep0 = new Vector3D;
		let tep1 = new Vector3D;
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
		
		const reps = tie.pattern == TiePattern.Perpendicular ? divisions + 1 : divisions;
		
		this.shapeSheetUtil.plottedDepthFunction = tie.surfaceDepthFunction;
		this.shapeSheetUtil.plottedMaterialIndexFunction = tie.surfaceMaterialIndexFunction;
		
		for( let i=1; i <= reps; ++i ) {
			const nextT = i/divisions;
			trackCurve(nextT, nextTrackPosition);
			Quaternion.slerp(startOrientation, endOrientation, nextT, true, nextOrientation);
			TransformationMatrix3D.fromQuaternion(nextOrientation, nextTransform);
			nextTransform.x1 = nextTrackPosition.x;
			nextTransform.y1 = nextTrackPosition.y;
			nextTransform.z1 = nextTrackPosition.z;
			
			switch( tie.pattern ) {
			case TiePattern.Perpendicular:
				prevTransform.multiplyVector(leftOffset , tep0);
				prevTransform.multiplyVector(rightOffset, tep1);
				break;
			case TiePattern.Zig:
				prevTransform.multiplyVector(leftOffset , tep0);
				nextTransform.multiplyVector(rightOffset, tep1);
				break;
			case TiePattern.ZigZag:
				if( (i & 1) == 1 ) {
					prevTransform.multiplyVector(leftOffset , tep0);
					nextTransform.multiplyVector(rightOffset, tep1);
				} else {
					prevTransform.multiplyVector(rightOffset, tep0);
					nextTransform.multiplyVector(leftOffset , tep1);
				}
				break;
			default:
				throw new Error("Unsupported tie pattern: "+tie.pattern);
			}
			
			this.shapeSheetUtil.plotLine(
				tep0.x, tep0.y, tep0.z, tie.radius,
				tep1.x, tep1.y, tep1.z, tie.radius
			);
			
			let tempTransform     = prevTransform    ; prevTransform     = nextTransform    ; nextTransform     = tempTransform    ;
			let tempOrientation   = prevOrientation  ; prevOrientation   = nextOrientation  ; nextOrientation   = tempOrientation  ;
			let tempTrackPosition = prevTrackPosition; prevTrackPosition = nextTrackPosition; nextTrackPosition = tempTrackPosition;
		}
	}
	
	drawTrack(trackType:TrackType, start:TrackEndpoint, end:TrackEndpoint) {
		const curve = trackCurve(start, end);
		const buf = new Vector3D;
		
		for( let t in trackType.ties ) {
			let tie = trackType.ties[t];
			this._drawTrackSegmentTies(tie, start.orientation, end.orientation, curve);
		}
		
		this._drawTrackSegmentRails(trackType.rails, start.orientation, end.orientation, curve, 16);
	}
	
	run():void {
		const scale = this.scale;
		
		const minusZ = new Vector3D(0,0,-1);
		
		const railMf = constantMaterialIndexFunction(4);
		const tieMf = constantMaterialIndexFunction(8);
		
		const y0 = -scale*2/3;
		const y1 = +scale*2/3;
		
		const leftRail:TrackTypeRail = {
			offset: new Vector3D(0, y0, 0),
			surfaceDepthFunction: NOOP_PLOTTED_DEPTH_FUNCTION,
			surfaceMaterialIndexFunction: railMf,
			radius: scale/8
		};
		const rightRail:TrackTypeRail = {
			offset: new Vector3D(0, y1, 0),
			surfaceDepthFunction: NOOP_PLOTTED_DEPTH_FUNCTION,
			surfaceMaterialIndexFunction: railMf,
			radius: scale/8
		};
		const bottomRail:TrackTypeRail = {
			offset: new Vector3D(0, 0, y1),
			surfaceDepthFunction: (x,y,z) => z+Math.random()*0.5,
			surfaceMaterialIndexFunction: tieMf,
			radius: scale/4
		};
		const tie1:TrackTypeTie = {
			surfaceDepthFunction: NOOP_PLOTTED_DEPTH_FUNCTION,
			surfaceMaterialIndexFunction: tieMf,
			pattern: TiePattern.Perpendicular,
			spacing: scale,
			y0: y0, y1: y1,
			radius: scale/10
		};
		const tie2:TrackTypeTie = {
			surfaceDepthFunction: NOOP_PLOTTED_DEPTH_FUNCTION,
			surfaceMaterialIndexFunction: tieMf,
			pattern: TiePattern.ZigZag,
			spacing: scale,
			y0: y0, y1: y1,
			radius: scale/10
		};
		const trackType:TrackType = {
			rails: [ leftRail, rightRail, bottomRail ],
			ties: [ tie1, tie2 ]
		};

		class TrackSegment { start : TrackEndpoint; end : TrackEndpoint; type : TrackType }
		
		const trackSegments:Array<TrackSegment> = [
			{
				start: {
					position: new Vector3D(scale*-1, scale*8, 0),
					orientation: Quaternion.fromXYZAxisAngle(1,0,0,0)
				},
				end: {
					position: new Vector3D(scale*3, scale*8, 0),
					orientation: Quaternion.fromXYZAxisAngle(1,0,0,0)
				},
				type: trackType
			},
			{
				start: {
					position: new Vector3D(scale*3, scale*8, 0),
					orientation: Quaternion.fromXYZAxisAngle(1,0,0,0)
				},
				end: {
					position: new Vector3D(scale*13, scale*3, 0),
					orientation: Quaternion.multiply(
						Quaternion.fromXYZAxisAngle(1,0,0,+Math.PI),
						Quaternion.fromXYZAxisAngle(0,0,1,+Math.PI/4)
					)
				},
				type: trackType
			},
			{
				start: {
					position: new Vector3D(scale*13, scale*3, 0),
					orientation: Quaternion.multiply(
						Quaternion.fromXYZAxisAngle(1,0,0,+Math.PI),
						Quaternion.fromXYZAxisAngle(0,0,1,+Math.PI/4)
					)
				},
				end: {
					position: new Vector3D(scale*17, scale*-1, 0),
					orientation: Quaternion.multiply(
						Quaternion.fromXYZAxisAngle(1,0,0,+Math.PI),
						Quaternion.fromXYZAxisAngle(0,0,1,+Math.PI/4)
					)
				},
				type: trackType
			}
		];
				
		for( const ts in trackSegments ) {
			const trackSeg = trackSegments[ts];
			this.drawTrack(trackSeg.type, trackSeg.start, trackSeg.end);
		}
		if( this.shapeSheetUtil.renderer ) this.shapeSheetUtil.renderer.requestCanvasUpdate();
		console.log("Rail demo...");
	}
}

export function buildDemo() {
	var canv = <HTMLCanvasElement>document.getElementById('shaded-preview-canvas');
	
	var shapeSheet = new ShapeSheet(canv.width, canv.height);
	var shapeSheetRenderer = new ShapeSheetRenderer(shapeSheet, canv);
	shapeSheetRenderer.shaders.push(ShapeSheetRenderer.makeFogShader(0, new SurfaceColor(0, 0, 0, 0.01)));
	var shapeSheetUtil = new ShapeSheetUtil(shapeSheet, shapeSheetRenderer);
	return new RailDemo(shapeSheetUtil);
}
