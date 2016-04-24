import KeyedList from './KeyedList';
import Vector3D from './Vector3D';
import LightColor from './LightColor';
import DirectionalLight from './DirectionalLight';
import { deepFreeze } from './DeepFreezer';

export const DEFAULT_LIGHTS:KeyedList<DirectionalLight> = {
	"primary": new DirectionalLight(
		new Vector3D(1,2,1),
		new LightColor(0.6, 0.6, 0.6), {
			shadowFuzz: 0.1,
			shadowDistance: 32,
			minimumShadowLight: 0.05
		}),
	"glow": new DirectionalLight(
		new Vector3D(-1,-2,-1),
		new LightColor(0.1, 0.01, 0.01), {
			shadowFuzz: 0.1,
			shadowDistance: 32,
			minimumShadowLight: 0.1
		})
};
deepFreeze(DEFAULT_LIGHTS, true);
