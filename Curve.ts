import {Vector3DBuffer} from './Vector3D';

type Curve = (t:number, v:Vector3DBuffer)=>void;

export default Curve;
