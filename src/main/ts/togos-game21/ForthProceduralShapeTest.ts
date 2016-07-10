import { assertEqualsPromise, registerTestResult } from './testing';
import { fixScriptText } from './ForthProceduralShape';

function lake( name:string, expectedFixed:string, input:string ):void {
	registerTestResult( "fixScriptText("+name+")", assertEqualsPromise(expectedFixed, fixScriptText(input)) );
}

lake("minimal script", "#G21-FPS-1.0\n", "");

lake("more headers",
	"#G21-FPS-1.0\n"+
	"#foo: bar\n"+
	"\n"+
	"script text\n",

	"#foo:bar\nscript text"
);
