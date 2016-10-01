import PrettierJSONEncoder from './PrettierJSONEncoder';
import { registerTestResult, assertEqualsPromise } from './testing';

registerTestResult("PrettierJSONEncoder - encode simple array", assertEqualsPromise(
	"[1,2,3]\n", PrettierJSONEncoder.stringify([1,2,3])
));

registerTestResult("PrettierJSONEncoder - encode non-simple array", assertEqualsPromise(
	"[\n\t[1,2,3],\n\t[4,5,6]\n]\n", PrettierJSONEncoder.stringify([[1,2,3],[4,5,6]])
));

registerTestResult("PrettierJSONEncoder - encode simple object", assertEqualsPromise(
	'{"x":1,"y":2,"z":3}\n', PrettierJSONEncoder.stringify({x:1,y:2,z:3})
));

registerTestResult("PrettierJSONEncoder - encode non-simple object", assertEqualsPromise(
	'{\n\t"a": [1,2,3],\n\t"b": {"x":1,"y":2,"z":3}\n}\n', PrettierJSONEncoder.stringify({a:[1,2,3],b:{x:1,y:2,z:3}})
));

const complexerObject = {
	a: [1,2,3],
	b: {
		x: 1, y: 2, z: 3,
		andAnotherThing: [
			{foo: "bar", baz: "quux"},
			{x:1,y:2,z:3},
			23, 48,
			undefined,
			true,
			false,
			null
		]
	}
};

console.log(PrettierJSONEncoder.stringify(complexerObject));

registerTestResult("PrettierJSONEncoder - encode/decode complex object", assertEqualsPromise(
	complexerObject, JSON.parse(PrettierJSONEncoder.stringify(complexerObject))
));
