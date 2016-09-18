import Datastore from './Datastore';
import MemoryDatastore from './MemoryDatastore';
import HTTPHashDatastore from './HTTPHashDatastore';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import GameDataManager from './GameDataManager';
import { registerTestResult, assertEqualsPromise } from './testing';

interface Thingy {
	name: string
	value: string
}

function testGameDataManager( testNamePrefix:string, ds:Datastore<Uint8Array> ) {
	const objectMapManager = new DistributedBucketMapManager<string>(ds);
	const gdm = new GameDataManager(ds, objectMapManager);
	
	const storeProm = gdm.storeObject( <Thingy>{
		name: "Ken",
		value: "42"
	}, 'urn:ken');
	
	const expectedKen = {
		name: "Ken",
		value: "42"
	};
	
	const fetchProm1 = gdm.fetchObject<Thingy>('urn:ken').then( (v:Thingy) => {
		return assertEqualsPromise(expectedKen, v, 'urn:ken resolved to not what we expected after fastStoring: '+JSON.stringify(v));
	});
	registerTestResult(testNamePrefix+' fetch ken', fetchProm1);
	
	const fetchProm2 = fetchProm1.then(() => {
		//console.log('Waiting for store promise to finish before clearing cache...');
		return storeProm.then( (urn) => {
			//console.log("Store promise resolved! urn:ken = "+urn);
		});
	}).then( () => {
		const cachedKen = gdm.getObjectIfLoaded('urn:ken');
		if( cachedKen == null ) {
			return Promise.reject(new Error('getObjectIfLoaded(\'urn:ken\') should have returned null before cache clear'));
		}
		
		gdm.clearCache();
		const nullKen = gdm.getObjectIfLoaded('urn:ken');
		if( nullKen != null ) {
			return Promise.reject(new Error('getObjectIfLoaded(\'urn:ken\') should have returned null right after cache clear'));
		}
		
		return {};
	});
	registerTestResult(testNamePrefix+' get ken after cache clear', fetchProm2);

	const fetchProm3 = fetchProm2.then( () => gdm.fetchObject<Thingy>('urn:ken') ).then( (v:Thingy) => {
		return assertEqualsPromise(expectedKen, v, 'urn:ken resolved to not what we expected after re-fetching: '+JSON.stringify(v));
	});
	registerTestResult(testNamePrefix+' fetch ken after cache clear', fetchProm3);

	const expectedKen2 = {
		name: 'Ken II',
		value: '43'
	};
	const storeProm2 = fetchProm3.then( () => gdm.storeObject({
		name: 'Ken II',
		value: '43'
	}, 'urn:ken'));
	registerTestResult(testNamePrefix+' get ken, take II', fetchProm3.then( () => {
		// Before storeProm2 has finished!
		return assertEqualsPromise(expectedKen2, gdm.getObjectIfLoaded('urn:ken'), "got urn:ken after initiating storage of new version");
	}));
	registerTestResult(testNamePrefix+' fetch ken, take II, not waiting for store to finish', fetchProm3.then( () => {
		return gdm.fetchObject('urn:ken').then( (v) => {
			return assertEqualsPromise(expectedKen2, v, 'fetched urn:ken after initiating storage of new version');
		});
	}));
	const fetchProm4 = fetchProm3.then( () => {
		return storeProm2;
	}).then( () => {
		return gdm.fetchObject('urn:ken').then( (v) => {
			return assertEqualsPromise(expectedKen2, v, 'fetched urn:ken after completing storage of new version');
		});
	});
	registerTestResult(testNamePrefix+' fetch ken, take II, after waiting for store to finish', fetchProm4);
	
	// Then we'll test fast stores!
	
	const ben = {
		name: "Ben",
		value: 33
	};
	const anon = {
		name: "Anon",
		value: 76
	};
	registerTestResult(testNamePrefix+' fastStoreObject', fetchProm4.then( () => {
		const benUrn = gdm.fastStoreObject( ben, 'urn:ben' );
		if( benUrn == null ) return {failures: [{message: "fastStoreObject(ben,'urn:ben') didn't return a URN. >:("}]};
		const anonUrn = gdm.fastStoreObject( anon );
		if( anonUrn == null ) return {failures: [{message: "fastStoreObject(anon) didn't return a URN. >:("}]};
		return {}
	}));
}

const mds = MemoryDatastore.createSha1Based(1);
testGameDataManager( "MemoryDatastore-backed GameDataManager", mds );

const hds = new HTTPHashDatastore;
testGameDataManager( "HTTPHashDatastore-backed GameDataManager", hds );
