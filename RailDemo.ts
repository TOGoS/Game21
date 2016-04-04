import Vector3D from './Vector3D';
import Curve from './Curve';
import {makeCubicBezierCurve} from './Bezier';
import ShapeSheet from './ShapeSheet';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil from './ShapeSheetUtil';
import SurfaceColor from './SurfaceColor';

class TrackEndpoint {
	public position:Vector3D;
	public forward:Vector3D;
	public up:Vector3D;
}
class TrackTypeRail {
	public materialIndex:number;
	public offset:Vector3D;
	public radius:number;
}
class TrackType {
	public rails:Array<TrackTypeRail>;
}

export default class RailDemo {
	protected shapeSheetUtil:ShapeSheetUtil;
	constructor(util:ShapeSheetUtil) {
		this.shapeSheetUtil = util;
	}
	
	drawRail(trackType:TrackType, start:TrackEndpoint, end:TrackEndpoint) {
		var scale = 16;
		var curve:Curve = makeCubicBezierCurve(
			new Vector3D(scale*1, scale*8, 0),
			new Vector3D(scale*1, scale*6, 0),
			new Vector3D(scale*2, scale*4, 0),
			new Vector3D(scale*3, scale*3, 0)
		);
		this.shapeSheetUtil.plotCurve(curve, 2, 2, this.shapeSheetUtil.plotSphere);
	}
	
	run():void {
		this.drawRail(null, null, null);
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
