import Datastore from './Datastore';
import KeyedList from './KeyedList';
import MemoryDatastore from './MemoryDatastore';
import { storeValues, fetchValue, emptyNodeUri } from './DistributedBucketMap';
import { registerTestResult, failPromise, assertEqualsPromise } from './testing';

const testDs:Datastore<Uint8Array> = MemoryDatastore.createSha1Based(1);

const theEmptyNodeUri:string = emptyNodeUri(testDs);

const dbmSettings = {
	maxBranchCount: 4,
	maxJsonSize: 1024,
};

registerTestResult(
	"DistributedMapTest update with empty list",
	storeValues( <KeyedList<string>>{}, theEmptyNodeUri, testDs, dbmSettings ).then( (storedNothingUri:string) => {
		return assertEqualsPromise(theEmptyNodeUri, storedNothingUri, "Storing nothing should result in the original node URI");
	}));

registerTestResult(
	"DistributedMapTest update with lal and lolol",
	storeValues( {"abc": "urn:lalal", "xyz": "urn:lolol"}, theEmptyNodeUri, testDs, dbmSettings ).then( (lalNodeUri:string) => {
		return lalNodeUri == theEmptyNodeUri ?
			failPromise("Updated DBM node should have different URI than the empty one") :
			Promise.resolve({ });
	}));
