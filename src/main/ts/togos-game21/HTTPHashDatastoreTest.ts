/// <reference path="../Promise.d.ts" />

import HTTPHashDatastore from './HTTPHashDatastore';
import {registerTestResult} from './testing';

// Test!

import { utf8Encode } from '../tshash/index';

registerTestResult( new Promise( (resolve,reject) => {
	const data = utf8Encode("Hello, world!");
	const ds = new HTTPHashDatastore;
	const uri = ds.store(data, (success,errorInfo) => {
		console.log("http response got!");
		if( success ) resolve( { } );
		else resolve( { errors: [ errorInfo ] } );
	} );
}), "HTTPHashDatastore test");
