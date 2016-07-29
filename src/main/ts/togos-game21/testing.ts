/// <reference path="../Promise.d.ts" />
/// <reference path="../node.d.ts" />

import ErrorInfo from './ErrorInfo';

function setExitCode( c:number ):void {
	if( typeof(process) == 'object' ) process.exitCode = c;
}

import KeyedList from './KeyedList';

// More structured method...

export interface TestResult {
	errors?: Array<ErrorInfo>,
	failures?: Array<ErrorInfo>,
	notes?: Array<string>,
	data?: KeyedList<any>
}

export function testPassed( res:TestResult ) {
	if( res.errors ) for( let e in res.errors ) return false;
	if( res.failures ) for( let e in res.failures ) return false;
	return true;
}

export function testResultToString( res:TestResult ) {
	const lines:string[] = [];
	if( res.errors ) {
		for( let e in res.errors ) lines.push(res.errors[e].message);
	}
	if( res.failures ) {
		for( let e in res.failures ) lines.push(res.failures[e].message);
	}
	return lines.join("\n");
}

export interface TestHarness {
	registerTestResult( testName:string, res:Promise<TestResult> ):void;
}

class CommandLineTestHarness implements TestHarness {
	public verbosity:number = 0;
	
	registerTestResult( testName:string, resP:Promise<TestResult> ) {
		resP.catch( (err) => {
			return {errors: [err]};
		}).then( (res:TestResult) => {
			if( !testPassed(res) ) {
				console.error("Test '"+testName+"' did not pass", res);
				setExitCode(1);
			}
			if( res.notes && this.verbosity > 0 ) {
				if( console.group ) console.group("Notes from "+testName);
				for( let n in res.notes ) {
					console.log(res.notes[n]);
				}
				if( console.groupEnd ) console.groupEnd();
			}
		})
	}
	
	static fromEnvironment():CommandLineTestHarness {
		let verbosity = 0;
		if( process && process.argv ) {
			for( let i = 2; i < process.argv.length; ++i ) {
				if( process.argv[i] == '-v' ) {
					verbosity = 1;
				} else {
					throw new Error("Unrecognized argument to test system: "+process.argv[i]);
				}
			}
		}
		let th = new CommandLineTestHarness();
		th.verbosity = verbosity;
		return th;
	}
}

export var testHarness = CommandLineTestHarness.fromEnvironment();

export function registerTestResult( testName:string, res:Promise<TestResult> ):void {
	testHarness.registerTestResult( testName, res );
}

// TODO: Make this handle uint8arrays, dataviews in a reasonable way,
// e.g. by hex-encoding them.
export function toJson( v:any ):string {
	return JSON.stringify(v, null, "  ");
}

export function failPromise( msg:string ):Promise<TestResult> {
	return Promise.reject( new Error(msg) );
}

export function assertEqualsPromise( a:any, b:any, msg?:string ):Promise<TestResult> {
	const aJson = toJson(a);
	const bJson = toJson(b);
	if( aJson != bJson ) {
		return failPromise( "Assertion failed: " + aJson + " != " + bJson + (msg ? "; "+msg : "") );
	} else {
		return Promise.resolve( { } );
	}
}

// As an alternative to registerTestResult:

export var currentTestName = "(anonymous test)";

export function fail( message:string ):void {
	registerTestResult( currentTestName, Promise.resolve( { failures: [ { message:message} ] } ) );
	// Don't want to continue!
	throw new Error(message);
}

export function assertEquals( a:any, b:any, msg?:string ):void {
	const aJson = toJson(a);
	const bJson = toJson(b);
	if( aJson != bJson ) {
		fail( "Assertion failed: " + aJson + " != " + bJson + (msg ? "; "+msg : "") );
	}
}
