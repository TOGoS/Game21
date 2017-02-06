export type AnimationCurveName = "none"|"once"|"loop"|"reverse";
// What about sine?  that'd be a good one.

type AnimationCurve = (time:number)=>number;
export const namedAnimationCurves:{[k:string]:AnimationCurve} = {
	"none": (time:number) => 0,
	"once": (time:number) => time < 0 ? 0 : time > 1 ? 1 : time,
	"loop": (time:number) => time - Math.floor(time),
	"reverse": (time:number) => {
		let t2 = time - 2*Math.floor(time/2);
		return t2 > 1 ? 2 - t2 : t2;
	}
};

export default AnimationCurve;
