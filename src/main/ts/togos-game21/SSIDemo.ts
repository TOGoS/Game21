import Rectangle from './Rectangle';
import Vector3D from './Vector3D';
import TransformationMatrix3D from './TransformationMatrix3D';
import Quaternion from './Quaternion';
import ShapeSheet from './ShapeSheet';
import ShapeSheetRenderer from './ShapeSheetRenderer';
import ShapeSheetUtil from './ShapeSheetUtil';
import ImageSlice from './ImageSlice';
import {DEFAULT_LIGHTS} from './Lights';
import {DEFAULT_MATERIALS} from './Materials';

export default class SSIDemo {
	protected ssu : ShapeSheetUtil;
	protected scale = 16;
	protected materials = DEFAULT_MATERIALS;
	protected lights = DEFAULT_LIGHTS;
	
	protected get centerX() { return this.ssu.shapeSheet.width/2; }
	protected get centerY() { return this.ssu.shapeSheet.height/2; }
	
	public constructor() {
		this.ssu = new ShapeSheetUtil(new ShapeSheet(this.scale*20, this.scale*20));
	}
	
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
	
	protected plotSomething() {
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
