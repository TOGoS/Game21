import LightColor from './LightColor';
import Vector3D from './Vector3D';

export default class DirectionalLight {
	public shadowFuzz:number = 0;
	public shadowDistance:number = Infinity;
	public minimumShadowLight:number = 0;
	public traceVector:Vector3D;
	public traceVectorLength:number;
	
	constructor(public direction:Vector3D, public color:LightColor, {
		shadowFuzz, shadowDistance, minimumShadowLight} = {shadowFuzz:0, shadowDistance:Infinity, minimumShadowLight:0
	}) {
		this.shadowFuzz = shadowFuzz;
		this.shadowDistance = shadowDistance;
		this.minimumShadowLight = minimumShadowLight;
		this.fix();
	}
	
	protected fix() {
		if( this.direction != null ) {
			this.direction = this.direction.normalize();
			this.traceVector = this.direction.scale(-1);
			this.traceVectorLength = this.traceVector.length;
		}
	}
	
	public static fromProperties( props ) {
		return new DirectionalLight( props.direction, props.color, props );
	};
}
