import KeyedList from './KeyedList';
import Datastore from './Datastore';
import { storeObject, fetchObject } from './JSONObjectDatastore';

interface DistributedBucketMap<T> {
	/**
	 * If prefixLength == null, then valueUris maps IDs to URIs of their values.
	 * Otherwise, subBucketUris maps ID substrings (0...prefixLength) to URIs of sub-buckets.
	 * When referencing JSON-encoded sub-buckets, the URIs may be of the form "<data-uri>#"
	 * e.g. "urn:sha1:Q3YKN7XGWUNNHBBZNF2CRMQPWIXWEENY#", which means
	 * 'the thing (specific type implied by context) represented by the JSON with this hash'
	 */
	prefixLength? : number;
	subBucketUris? : KeyedList<string>;
	values? : KeyedList<T>;
	/** Total count of all entries in this node and all sub-buckets */
	entryCount : number;
}

interface DistributedBucketMapSettings {
	// If a node would be created with more than this many branches,
	// it needs to be subdivided
	maxBranchCount : number;
	// If a node's JSON representation is > this many bytes,
	// it needs to be subdivided.
	maxJsonSize : number;
}

export default DistributedBucketMap;

function _fetchValue<T>( valueName:string, node:DistributedBucketMap<T>, datastore:Datastore<Uint8Array> ):Promise<T|null> {
	if( node.prefixLength == null ) {
		return Promise.resolve( node.values[valueName] );
	} else {
		const prefix = valueName.substr(0, node.prefixLength);
		const subBucketUri = node.subBucketUris[prefix];
		if( subBucketUri == null ) return Promise.resolve(null);
		return fetchValue(valueName, subBucketUri, datastore);
	}
}

export function fetchValue<T>( valueName:string, nodeUri:string|DistributedBucketMap<T>, datastore:Datastore<Uint8Array> ):Promise<T|null> {
	if( typeof(nodeUri) === 'string' ) {
		return fetchObject(nodeUri, datastore).then( (obj:any) => {
			return _fetchValue(valueName, <DistributedBucketMap<T>>obj, datastore);
		});
	} else {
		return _fetchValue( valueName, <DistributedBucketMap<T>>nodeUri, datastore );
	}
}

//// Updating's a bit more complex

function updateValues<T>( original:KeyedList<T>, updates:KeyedList<T> ):KeyedList<T> {
	const clone : KeyedList<T> = { };
	for( let k in original ) clone[k] = original[k];
	for( let k in updates ) {
		if( updates[k] == null ) delete clone[k];
		else clone[k] = updates[k];
	}
	return clone;
};

function kCount<T>( l:KeyedList<T> ):number {
	let count = 0;
	for( let k in l ) ++count;
	return count;
}

function leafNode<T>( values:KeyedList<T> ):DistributedBucketMap<T> {
	return {
		values: values,
		entryCount: kCount(values),
	};
}

// TODO: Will probably need to return some structure including
// metadata about the new node so we don't have to re-request it
// and count its entries or whatever

export function _storeValues<T>(
	updates:KeyedList<T>, node:DistributedBucketMap<T>, nodeUri:string,
	datastore:Datastore<Uint8Array>, settings:DistributedBucketMapSettings
):Promise<string> {
	let newValues:KeyedList<T>;
	if( node.prefixLength == null ) {
		let anythingChanged = false;
		for( let k in updates ) {
			const newVal = updates[k];
			if( node.values[k] != newVal ) anythingChanged = true;
		}
		if( !anythingChanged ) return Promise.resolve(nodeUri);
		
		node = leafNode(updateValues( node.values, updates ));
	} else {
		throw new Error("Blah");
	}
	
	// TODO: split up if violating size constraints
	
	// At this point, node is some mutable DistributedBucketMap
	// that we're going to mess with.
	return Promise.resolve( storeObject(node, datastore) );
}

export function storeValues<T>(
	updates:KeyedList<T>, nodeUri:string,
	datastore:Datastore<Uint8Array>, settings:DistributedBucketMapSettings
):Promise<string> {
	
	return fetchObject( nodeUri, datastore ).then( (obj:any) => {
		return _storeValues(updates, <DistributedBucketMap<T>>obj, nodeUri, datastore, settings);
	});
}

export function emptyNodeUri( datastore:Datastore<Uint8Array> ):string {
	return storeObject( leafNode( {} ), datastore );
}
