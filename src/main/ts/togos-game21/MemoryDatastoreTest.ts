import MemoryDatastore from './MemoryDatastore';
import { utf8Encode, utf8Decode } from '../tshash/utils';

import { assertEquals, assertEqualsPromise, registerTestResult } from './testing';

const md = MemoryDatastore.createSha1Based(1);
const fakeUrn = "urn:sha1:555HALIG6NCZTLXB7DNI56PXFFQDDXXX";
const hwUrn = md.store( utf8Encode("Hello, world!"), (storedSuccess) => {
	assertEquals( "Hello, world!", utf8Decode(md.get(hwUrn)) );
	
	registerTestResult(
		"MemoryDatastore#fetch returns stored data",
		md.fetch(hwUrn).then(
			(v) => ({}),
			(e) => ({ "failures": [ new Error("Failed to load "+hwUrn) ] })
		)
	);
	registerTestResult(
		"MemoryDatastore#fetch doesn't return non-stored data",
		md.fetch(fakeUrn).then(
			(v) => ({ "failures": [ new Error("Request for "+fakeUrn+" should have failed") ] }),
			(e) => ({})
		)
	);
} );

assertEquals( "urn:sha1:SQ5HALIG6NCZTLXB7DNI56PXFFQDDVUZ", hwUrn );
