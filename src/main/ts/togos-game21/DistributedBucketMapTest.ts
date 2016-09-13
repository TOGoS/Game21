import Datastore from './Datastore';
import KeyedList from './KeyedList';
import MemoryDatastore from './MemoryDatastore';
import { storeValues, fetchValue, emptyNodeUri, DistributedBucketMapManager } from './DistributedBucketMap';
import { TestResult, registerTestResult, failPromise, assertEqualsPromise } from './testing';

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
			Promise.resolve(<TestResult>{ notes: ["lalNodeUri: "+lalNodeUri] });
	}));

const dbm = new DistributedBucketMapManager<string>(testDs);
registerTestResult(
	"DistributedBucketMapManager works",
	new Promise( (resolve,reject) => {
		dbm.storeValues( {"foo": "fough"} );
		dbm.fetchValue("foo").then( (foo) => {
			if( foo != "fough" ) {
				reject(new Error("Foo should've mapped to 'fough' after storeValues({'foo':'fough'})"));
			}
		});
		dbm.storeValues( {"bar": "bargh", "baz": "bazzz"} );
		dbm.fetchValue("baz").then( (baz) => {
			if( baz != "bazzz" ) {
				reject(new Error("Baz should've mapped to 'bazzz' after storeValues({'bar':'bargh',baz':'bazzz'})"));
			}
		});
		dbm.storeValues( {"baz": undefined} );
		dbm.fetchValue("baz").then( (baz) => {
			if( baz !== undefined ) {
				reject(new Error("Baz should've mapped to undefined after storeValues({'baz':undefined})"));
			}
		});

		dbm.flushUpdates().then( () => {
			return dbm.fetchValue("foo").then( (foo) => {
				if( foo !== "fough" ) {
					reject(new Error("Foo should've mapped to 'fough' after flushUpdates"));
				}
			});
		}).then(() => {
			return dbm.fetchValue("baz").then( (baz) => {
				if( baz !== undefined ) {
					reject(new Error("Baz should've mapped to undefined after flushUpdates"));
				}
			});
		}).then(() => {
			resolve({});
		});

		setTimeout( () => reject(new Error("DistributedBucketMapManager test never finished.  :(")), 100);
	})
);
