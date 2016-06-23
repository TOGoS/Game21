/// <reference path="../Promise.d.ts" />
/// <reference path="../node.d.ts" />

import ErrorInfo from './ErrorInfo';

function setExitCode( c:number ):void {
	if( typeof(process) == 'object' ) process.exitCode = c;
}

import KeyedList from './KeyedList';

export function fail( message:string ):void {
	console.error( message );
	setExitCode(1);
	throw new Error(message);
}

export function assertEquals( a:any, b:any, msg?:string ):void {
	const aJson = JSON.stringify(a);
	const bJson = JSON.stringify(b);
	if( a != b ) {
		fail( "Assertion failed: " + aJson + " != " + bJson + (msg ? "; "+msg : "") );
	}
};

// More structured method...

export interface TestResult {
	errors?: Array<ErrorInfo>,
	failures?: Array<ErrorInfo>,
	notes?: Array<string>,
	data?: KeyedList<any>
}

let anyTestsFailed = false;

let allRegisteredTestResults:Array<Promise<TestResult>> = [];

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

export function registerTestResult( testName:string, res:Promise<TestResult> ) {
	allRegisteredTestResults.push(res);
	res.catch( (err):TestResult => ({ errors: [{message:err}] }) ).then( (res:TestResult) => {
		if( !testPassed(res) ) {
			console.error( "Errors during '"+testName+"':", testResultToString(res) );
			anyTestsFailed = true;
			setExitCode(1);
		}
		if( res.notes && res.notes.length > 0 ) {
			console.info("Notes from '"+testName+"':", res.notes);
		}
	});
}

export function flushRegisteredTestResults():Array<Promise<TestResult>> {
	const o = allRegisteredTestResults;
	allRegisteredTestResults = [];
	return o;
}
