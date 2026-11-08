import KeyedList from './KeyedList.ts';
import Vector3D from './Vector3D.ts';
import { makeVector } from './vector3ds.ts';
import LightColor from './LightColor.ts';
import DirectionalLight from './DirectionalLight.ts';
import { deepFreeze } from './DeepFreezer.ts';

export const DEFAULT_LIGHTS:KeyedList<DirectionalLight> = {
	"primary": new DirectionalLight(
		makeVector(1,2,1),
		new LightColor(0.6, 0.6, 0.6), {
			shadowFuzz: 0.1,
			shadowDistance: 32,
			minimumShadowLight: 0.05
		}),
	"glow": new DirectionalLight(
		makeVector(-1,-2,-1),
		new LightColor(0.1, 0.01, 0.01), {
			shadowFuzz: 0.1,
			shadowDistance: 32,
			minimumShadowLight: 0.1
		})
};
deepFreeze(DEFAULT_LIGHTS, true);
