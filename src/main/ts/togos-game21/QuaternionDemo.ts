import Rectangle from './Rectangle.ts';
import Vector3D from './Vector3D.ts';
import { makeVector } from './vector3ds.ts';
import TransformationMatrix3D from './TransformationMatrix3D.ts';
import Quaternion from './Quaternion.ts';
import ShapeSheet from './ShapeSheet.ts';
import ShapeSheetRenderer from './ShapeSheetRenderer.ts';
import ShapeSheetUtil, {constantMaterialIndexFunction, NOOP_PLOTTED_DEPTH_FUNCTION} from './ShapeSheetUtil.ts';
import ImageSlice from './ImageSlice.ts';
import ProceduralShape from './ProceduralShape.ts';
import Animation, { AnimationType } from './Animation.ts';
import ObjectVisual, {ObjectVisualState, ObjectVisualFrame, VisualBasisType} from './ObjectVisual.ts';
import {DEFAULT_MATERIAL_MAP, IDENTITY_MATERIAL_REMAP} from './surfacematerials.ts';
import ObjectImageManager, {compressQuaternion, decompressQuaternion} from './ObjectImageManager.ts';

class ArrowShape implements ProceduralShape {
	animationType = AnimationType.NONE;
	estimateOuterBounds( t:number, xf:TransformationMatrix3D ):Rectangle {
		const scale = xf.scale;
		return new Rectangle(-2*scale,-2*scale,2*scale,2*scale);
	}
	draw( ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D ) {
		const scale = xf.scale;
		
		ssu.plottedDepthFunction = NOOP_PLOTTED_DEPTH_FUNCTION;
		const v0 = xf.multiplyVector( makeVector( 0, -0.5, 0 ) );
		const v1 = xf.multiplyVector( makeVector( 1,  0.0, 0 ) );
		const v2 = xf.multiplyVector( makeVector( 0, +0.5, 0 ) );
		
		const lineRad = scale/8;
		ssu.plottedMaterialIndexFunction = () => { return 4; }
		ssu.plotLine( v0.x, v0.y, v0.z, lineRad, v1.x, v1.y, v1.z, lineRad );
		ssu.plottedMaterialIndexFunction = () => { return 8; }
		ssu.plotLine( v2.x, v2.y, v2.z, lineRad, v1.x, v1.y, v1.z, lineRad );
	}
}

export default class QuaternionDemo {
	protected objectImageManager:ObjectImageManager = new ObjectImageManager;
	
	public generateObjectVisualFrame():ObjectVisualFrame {
		const shape:ArrowShape = new ArrowShape();
		return {
			visualBasisType: VisualBasisType.PROCEDURAL,
			materialRemap: IDENTITY_MATERIAL_REMAP,
			shape: shape
		};
	}

	public generateObjectVisual():ObjectVisual {
		const frame:ObjectVisualFrame = this.generateObjectVisualFrame();
		
		return {
			materialMap: DEFAULT_MATERIAL_MAP,
			maVisual: {
				states: [
					{
						orientation: Quaternion.IDENTITY,
						materialRemap: IDENTITY_MATERIAL_REMAP,
						animation: {
							type : AnimationType.NONE,
							length: Infinity,
							frames: [this.generateObjectVisualFrame()]
						}
					}
				]
			}
		};
	}	
	
	public generateImageSlice( q:Quaternion ):ImageSlice<HTMLImageElement> {
		const slice = this.objectImageManager.objectVisualImage(this.generateObjectVisual(), {}, 0, q, 32);
		if( !slice ) throw new Error("Failed to generate image slice!");
		return slice;
	}
	
	public static snap( q:Quaternion ):Quaternion {
		return decompressQuaternion( compressQuaternion(q) );
	}
}
