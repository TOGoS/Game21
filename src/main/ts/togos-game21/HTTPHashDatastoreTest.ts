/// <reference path="../Promise.d.ts" />

import HTTPHashDatastore from './HTTPHashDatastore';
import ErrorInfo from './ErrorInfo';
import {registerTestResult, TestResult} from './testing';

// Test!

import { utf8Encode } from '../tshash/index';

registerTestResult( 'HTTPHashDatastore store hello world', new Promise<TestResult>( (resolve,reject) => {
	const data = utf8Encode("Hello, world!");
	const ds = new HTTPHashDatastore;
	const uri = ds.store(data, (success:boolean, errorInfo?:ErrorInfo) => {
		if( success ) resolve( { } );
		else resolve( { errors: [ errorInfo ? errorInfo : { message: "Storage request failed inexplicably" } ] } );
	} );
}));
