import Rectangle from './Rectangle';
import Vector3D from './Vector3D';
import { makeVector } from './vector3ds';
import TransformationMatrix3D from './TransformationMatrix3D';
import Quaternion from './Quaternion';
import ShapeSheet from './ShapeSheet';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil, {constantMaterialIndexFunction, NOOP_PLOTTED_DEPTH_FUNCTION} from './ShapeSheetUtil';
import ImageSlice from './ImageSlice';
import ProceduralShape from './ProceduralShape';
import Animation, { AnimationTypeID } from './Animation';
import ObjectVisual, {ObjectVisualState, ObjectVisualFrame, VisualBasisType} from './ObjectVisual';
import {DEFAULT_MATERIAL_MAP, IDENTITY_MATERIAL_REMAP} from './surfacematerials';
import ObjectImageManager, {compressQuaternion, decompressQuaternion} from './ObjectImageManager';

class ArrowShape implements ProceduralShape {
	animationTypeId = AnimationTypeID.NONE;
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
							type : AnimationTypeID.NONE,
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
