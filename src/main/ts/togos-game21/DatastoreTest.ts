import Datastore from './Datastore';
import ErrorInfo from './ErrorInfo';
import {registerTestResult, TestResult} from './testing';
import {utf8Decode} from 'tshash/utils';

// Test!

import { utf8Encode } from 'tshash';

const expectedUrnRegex = /^urn:(sha1|bitprint):SQ5HALIG6NCZTLXB7DNI56PXFFQDDVUZ/;

export function testDatastore( name:string, ds:Datastore<Uint8Array> ) {
	registerTestResult( name+' store and fetch hello world', new Promise<TestResult>( (resolve,reject) => {
		const data = utf8Encode("Hello, world!");
		
		const urn = ds.fastStore(data);
		if( !expectedUrnRegex.exec(urn) ) {
			reject(new Error("fastStore didn't expect the URN we expected: "+urn));
		}
		
		resolve(
			ds.store(data).then( (urn) => {
				return expectedUrnRegex.exec(urn) ? Promise.resolve(urn) : Promise.reject(new Error("URN didn't match expected: "+urn))
			}).then( (urn) => {
				return ds.fetch(urn).then( (val) => {
					const str = utf8Decode(val);
					if( str != "Hello, world!" ) {
						return Promise.reject(new Error("Value got back from fetching "+urn+" didn't match expected"));
					} else {
						return Promise.resolve({});
					}
				});
			})
		);
	}));
}
