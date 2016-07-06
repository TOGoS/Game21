import Rectangle from './Rectangle';
import Vector3D from './Vector3D';
import TransformationMatrix3D from './TransformationMatrix3D';
import Quaternion from './Quaternion';
import ShapeSheet from './ShapeSheet';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil, {constantMaterialIndexFunction, NOOP_PLOTTED_DEPTH_FUNCTION} from './ShapeSheetUtil';
import ImageSlice from './ImageSlice';
import ProceduralShape from './ProceduralShape';
import Animation, { AnimationType } from './Animation';
import ObjectVisual, {ObjectVisualState, ObjectVisualFrame, VisualBasisType} from './ObjectVisual';
import {DEFAULT_MATERIAL_MAP, IDENTITY_MATERIAL_REMAP} from './materials';
import ObjectImageManager from './ObjectImageManager';

class CoilShape implements ProceduralShape {
	public matCount:number = 3;
	public matSpan:number = 4;
	public scale:number = 1;
	public minS:number = 0.7;
	public maxS:number = 1.5;
	
	public get animationType() {
		return this.minS != this.maxS ? AnimationType.REVERSE : AnimationType.NONE;
	}
	
	estimateOuterBounds( t:number, xf:TransformationMatrix3D ):Rectangle {
		const scale = xf.scale;
		return new Rectangle(-16*scale,-16*scale,16*scale,16*scale);
	}
	draw( ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D ) {
		const mts = xf.multiply(TransformationMatrix3D.scale(this.scale));
		const scale = mts.scale;
		
		const s = 0.01+Math.random()*0.03;
		const matCount = (1+Math.round(Math.random()*3))|0;
		const matSpan = Math.random() * 6;
		let u:number;
		ssu.plottedDepthFunction = NOOP_PLOTTED_DEPTH_FUNCTION;
		ssu.plottedMaterialIndexFunction = () => {
			return 4+(u/matSpan+Math.random()) % (matCount*4);
		};
		const v = new Vector3D;
		for( u=0; u < 200; ++u ) {
			v.set( u*s, Math.sin(u*0.1), Math.cos(u*0.1));
			mts.multiplyVector(v, v);
			ssu.plotSphere(v.x, v.y, v.z, scale*0.2);
		}

	}
}

export default class SSIDemo {
	protected objectImageManager:ObjectImageManager = new ObjectImageManager(null);
		
	public randomObjectVisualFrame():ObjectVisualFrame {
		const shape:CoilShape = new CoilShape();
		return {
			visualBasisType: VisualBasisType.PROCEDURAL,
			materialRemap: IDENTITY_MATERIAL_REMAP,
			shape: shape
		};
	}

	public randomObjectVisual():ObjectVisual {
		const frame:ObjectVisualFrame = this.randomObjectVisualFrame();
		
		return {
			materialMap: DEFAULT_MATERIAL_MAP,
			maVisual: {
				states: [
					{
						orientation: Quaternion.IDENTITY,
						materialRemap: IDENTITY_MATERIAL_REMAP,
						applicabilityFlagsMin: 0,
						applicabilityFlagsMax: 0,
						animation: {
							type: AnimationType.NONE,
							length: Infinity,
							frames: [this.randomObjectVisualFrame()]
						}
					}
				]
			}
		};
	}	
	public randomShapeImageSlice():ImageSlice<HTMLImageElement> {
		return this.objectImageManager.objectVisualImage(this.randomObjectVisual(), 0, 0, Quaternion.random());
	};
}
