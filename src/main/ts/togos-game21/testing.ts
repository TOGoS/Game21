/// <reference path="../Promise.d.ts" />

interface ProcessWithExitCode extends NodeJS.Process {
	exitCode:number;
}

function setExitCode( c:number ):void {
	if( process ) (<ProcessWithExitCode>process).exitCode = c;
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
	errors?: Array<any>,
	failures?: Array<any>,
	information?: KeyedList<any>
}

let anyTestsFailed = false;

export function registerTestResult( res:Promise<TestResult>, name?:string ) {
	res.catch( (err):TestResult => ({ errors: [{message:err}] }) ).then( (res:TestResult) => {
		let failed = false;
		if( res.errors && res.errors.length > 0 ) {
			console.error("Errors during "+(name ? name : "test")+":", res.errors);
			failed = true;
		}
		if( res.failures && res.failures.length > 0 ) {
			console.error((name ? name : "test")+" failures:", res.errors);
			failed = true;
		}
		if( failed ) {
			anyTestsFailed = true;
			setExitCode(1);
		}
	});
}