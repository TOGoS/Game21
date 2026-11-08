import BrowserStorageDatastore from './BrowserStorageDatastore.ts';
import { testDatastore } from './DatastoreTest.ts';
import { sha1Urn, hexDecode, hexEncode } from '../tshash/index.ts';
import { registerTestResult, assertEqualsPromise, TestResult } from './testing.ts';

const ctx = typeof window != 'undefined' ? window : null;

if( ctx && ctx.localStorage ) {
	ctx.localStorage.clear();

	const stor = new BrowserStorageDatastore(sha1Urn, window.localStorage);
	testDatastore("BrowserStorageDatastore", stor);

	registerTestResult("BrowserStorageDatastoreTest - non-utf8 data", new Promise<TestResult>( (resolve, reject) => {
		const somethHex = "00ff01fe";
		const somethRef = stor.fastStore(hexDecode(somethHex));
		const somethFetched = stor.get(somethRef);
		if( somethFetched == null ) reject(new Error("Failed to fetch "+somethRef+" back from BrowserStorageDatastore"));
		else resolve(assertEqualsPromise(somethHex, hexEncode(somethFetched)));
	}));
} else {
	console.log("Skipped browser storage test since localStorage doesn't exist!");
}
