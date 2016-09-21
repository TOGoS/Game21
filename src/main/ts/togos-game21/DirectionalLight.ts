import LightColor from './LightColor';
import Vector3D from './Vector3D';
import { parseVector } from './vector3ds';
import { normalizeVector, scaleVector, vectorLength } from './vector3dmath';

export default class DirectionalLight {
	public shadowFuzz:number = 0;
	public shadowDistance:number = Infinity;
	public minimumShadowLight:number = 0;
	public traceVector:Vector3D;
	public traceVectorLength:number;
	
	constructor(public direction:Vector3D, public color:LightColor, props:any) {
		this.shadowFuzz = props.shadowFuzz;
		this.shadowDistance = props.shadowDistance;
		this.minimumShadowLight = props.minimumShadowLight;
		this.fix();
	}
	
	protected fix() {
		if( this.direction != null ) {
			this.direction = normalizeVector(this.direction);
			this.traceVector = scaleVector(this.direction, -1);
			this.traceVectorLength = vectorLength(this.traceVector);
		}
		if( typeof this.shadowFuzz != 'number' ) this.shadowFuzz = 0;
		if( typeof this.shadowDistance != 'number' ) this.shadowDistance = Infinity;
		if( typeof this.minimumShadowLight != 'number' ) this.minimumShadowLight = 0;
	}
	
	public static createFrom( props:any ):DirectionalLight {
		return new DirectionalLight( parseVector(props.direction), LightColor.from(props.color), props );
	};
}
