import Rectangle from './Rectangle';
import Vector3D from './Vector3D';
import TransformationMatrix3D from './TransformationMatrix3D';
import Quaternion from './Quaternion';
import ShapeSheet from './ShapeSheet';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil, {constantMaterialIndexFunction, NOOP_PLOTTED_DEPTH_FUNCTION} from './ShapeSheetUtil';
import ImageSlice from './ImageSlice';
import ProceduralShape from './ProceduralShape';
import Animation, {OnAnimationEnd} from './Animation';
import ObjectVisual, {ObjectVisualState, ObjectVisualFrame, VisualBasisType} from './ObjectVisual';
import {DEFAULT_LIGHTS} from './Lights';
import {DEFAULT_MATERIALS, IDENTITY_MATERIAL_REMAP} from './Materials';

class CoilShape implements ProceduralShape {
	public matCount:number = 3;
	public matSpan:number = 4;
	public scale:number = 1;
	public minS:number = 0.7;
	public maxS:number = 1.5;
	
	public get isAnimated() {
		return this.minS != this.maxS;
	}
	
	estimateOuterBounds( t:number, xf:TransformationMatrix3D ):Rectangle {
		const scale = xf.scale;
		return new Rectangle(-16*scale,-256*scale,256*scale,256*scale);
	}
	draw( ssu:ShapeSheetUtil, t:number, xf:TransformationMatrix3D ) {
		const mts = xf.multiply(TransformationMatrix3D.scale(this.scale));
		const scale = mts.scale;
		
		const s = 0.01+Math.random()*0.03;
		const matCount = (1+Math.round(Math.random()*3))|0;
		const matSpan = Math.random() * 6;
		let u;
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
	protected ssu : ShapeSheetUtil;
	protected scale = 16;
	protected materials = DEFAULT_MATERIALS;
	protected lights = DEFAULT_LIGHTS;
	public resolution = 16;
	
	protected get centerX():number { return this.ssu.shapeSheet.width/2; }
	protected get centerY():number { return this.ssu.shapeSheet.height/2; }
	
	public constructor() {
		this.ssu = new ShapeSheetUtil(new ShapeSheet(this.scale*20, this.scale*20));
	}
	
	/*
	protected plotCoil() {
		const dir = Quaternion.random();
		const scale = Math.random()*this.scale*2;
		const mts = TransformationMatrix3D
			.translation(new Vector3D(this.centerX, this.centerY, 0))
			.multiply(TransformationMatrix3D.fromQuaternion(dir))
			.multiply(TransformationMatrix3D.scale(scale));
		
		const s = 0.01+Math.random()*0.03;
		const matCount = (1+Math.round(Math.random()*3))|0;
		const matSpan = Math.random() * 6;
		let t;
		this.ssu.plottedMaterialIndexFunction = () => {
			return 4+(t/matSpan+Math.random()) % (matCount*4);
		};
		const v = new Vector3D;
		for( t=0; t < 200; ++t ) {
			v.set( t*s, Math.sin(t*0.1), Math.cos(t*0.1));
			mts.multiplyVector(v, v);
			this.ssu.plotSphere(v.x, v.y, v.z, scale*0.2);
		}
	}
	*/
	
	public randomObjectVisualFrame():ObjectVisualFrame {
		const shape:CoilShape = new CoilShape();
		return {
			visualBasisType: VisualBasisType.PROCEDURAL,
			materialRemap: IDENTITY_MATERIAL_REMAP,
			shape: shape
		};
		/*
		const r = Math.random();
		if( r < 0.1 ) {
			const size = Math.max(1, 2+Math.random()*30);
			this.ssu.plotSphere( this.centerX, this.centerY, 0, size );
		} else if( r < 0.5 ) {
			const bevel = Math.random() * 8;
			if( Math.random() < 0.5 ) {
				this.ssu.plotAASharpBeveledCuboid( 0, 0, 0, bevel*2+Math.random()*32, bevel*2+Math.random()*32, bevel );
			} else {
				this.ssu.plotAABeveledCuboid( 0, 0, 0, bevel*2+Math.random()*32, bevel*2+Math.random()*32, bevel );
			}
		} else {
			this.plotCoil();
		}
		*/
	}

	public randomObjectVisual():ObjectVisual {
		const frame:ObjectVisualFrame = this.randomObjectVisualFrame();
		
		return {
			materialMap: DEFAULT_MATERIALS,
			states: <Array<ObjectVisualState>>[
				{
					orientation: Quaternion.IDENTITY,
					applicabilityFlagsMin: 0,
					applicabilityFlagsMax: 0,
					animation: {
						speed: 0,
						onEnd: OnAnimationEnd.LOOP,
						frames: [this.randomObjectVisualFrame()]
					}
				}
			]
		};
	}
	
	protected plotObjectVisualFrame(ov:ObjectVisualFrame, t:number, xf:TransformationMatrix3D):void {
		switch( ov.visualBasisType ) {
		case VisualBasisType.PROCEDURAL:
			const shape:ProceduralShape = <ProceduralShape>ov.shape;
			shape.draw(this.ssu, t, xf);
			break;
		case VisualBasisType.SHAPESHEET:
			const slice:ImageSlice<ShapeSheet> = <ImageSlice<ShapeSheet>>ov.shape;
			const center = xf.multiplyVector(new Vector3D);
			this.ssu.blit(
				slice.sheet,
				slice.bounds.minX, slice.bounds.minY, slice.bounds.width, slice.bounds.height,
				center.x - slice.origin.x, center.y - slice.origin.y, center.z - slice.origin.z
			);
			break;
		default:
			throw new Error("Unsupported visual basis type: "+ov.visualBasisType);
		}
	}
	
	protected plotObjectVisual(ov:ObjectVisual, t:number, xf:TransformationMatrix3D):void {
		// Whatever there's only one frame jeez.
		this.plotObjectVisualFrame( ov.states[0].animation.frames[0], t, xf );
	}
	
	protected randomTransformation():TransformationMatrix3D {
		const centerVect = new Vector3D(this.centerX, this.centerY, 0);
		return TransformationMatrix3D.IDENTITY.
			multiply(TransformationMatrix3D.translation(centerVect)).
			multiply(TransformationMatrix3D.fromQuaternion(Quaternion.random())).
			multiply(TransformationMatrix3D.scale(this.resolution * Math.random()*2));
	}
	
	protected plotSomething() {
		this.plotObjectVisual(this.randomObjectVisual(), Math.random(), this.randomTransformation());
		/*
		this.ssu.plottedMaterialIndexFunction = () => {
			return 4+Math.random()*4;
		};
		const r = Math.random();
		if( r < 0.1 ) {
			const size = Math.max(1, 2+Math.random()*30);
			this.ssu.plotSphere( this.centerX, this.centerY, 0, size );
		} else if( r < 0.5 ) {
			const bevel = Math.random() * 8;
			if( Math.random() < 0.5 ) {
				this.ssu.plotAASharpBeveledCuboid( 0, 0, 0, bevel*2+Math.random()*32, bevel*2+Math.random()*32, bevel );
			} else {
				this.ssu.plotAABeveledCuboid( 0, 0, 0, bevel*2+Math.random()*32, bevel*2+Math.random()*32, bevel );
			}
		} else {
			this.plotCoil();
		}
		*/
	}
	
	public randomShapeImage():HTMLImageElement {
		
		//let materials = DEFAULT_MATERIALS;
		//let lights = DEFAULT_LIGHTS;
		
		this.ssu.clear();
		this.plotSomething();
		
		const sss = new ImageSlice(this.ssu.shapeSheet, new Vector3D(80,80,0), 16, this.ssu.shapeSheet.bounds);
		const croppedSss:ImageSlice<ShapeSheet> = ShapeSheetUtil.autocrop(sss, true);
		return ShapeSheetRenderer.shapeSheetToImage(croppedSss.sheet, this.materials, this.lights);
	};
}
