import Rectangle from './Rectangle';
import TransformationMatrix3D from './TransformationMatrix3D';
import ShapeSheetUtil from './ShapeSheetUtil';
import { AnimationType } from './Animation';
import ProceduralShape from './ProceduralShape';

interface ScriptProceduralShapeData {
	animationType : AnimationType;
	languageName : string; // "G21-FPS-1.0"
	maxRadius? : number;
	scriptText : string;
}

export default class ScriptProceduralShape implements ProceduralShape, ScriptProceduralShapeData {
	public animationType : AnimationType;
	public languageName : string;
	public maxRadius : number;
	public scriptText : string;
	
	public constructor( public data:ScriptProceduralShapeData ) {
		this.animationType = data.animationType;
		this.languageName = data.languageName;
		this.maxRadius = data.maxRadius;
		this.scriptText = data.scriptText;
	}
	
	public estimateOuterBounds( t:number, xf:TransformationMatrix3D ):Rectangle {
		throw new Error("Not implemented yet");
	}
	public draw( ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D ):void {
		throw new Error("Not implemented yet");
	}
}
