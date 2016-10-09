import KeyedList from './KeyedList';
import Datastore from './Datastore';
import ErrorInfo from './ErrorInfo';
import { storeObject, fastStoreObject, fetchObject } from './JSONObjectDatastore';
import { deepFreeze } from './DeepFreezer';

export const EMPTY_NODE:DistributedBucketMap<any> = deepFreeze(leafNode( {} ));
export const EMPTY_NODE_URI = "urn:sha1:GVEKPNGUKNG4NEVXMJBIPURTQHDBZ3ST";

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

function invalidNodeError<T>(node:DistributedBucketMap<T>, msg:string):Error {
	return new Error(msg+": "+JSON.stringify(node, null, "\t"));
}

function missingValuesError<T>(node:DistributedBucketMap<T>):Error {
	return invalidNodeError(node, "Node without prefix length should have values but does not");
}

function missingSubBucketUrisError<T>(node:DistributedBucketMap<T>):Error {
	return invalidNodeError(node, "Node with prefix length should have sub-bucket URIs but does not");
}

function fetchNode<T>( uri:string, ds:Datastore<Uint8Array> ):Promise<DistributedBucketMap<T>> {
	if( uri == EMPTY_NODE_URI ) return Promise.resolve( <DistributedBucketMap<T>>EMPTY_NODE );
	return fetchObject(uri, ds);
}

function _fetchValue<T>( valueName:string, node:DistributedBucketMap<T>, datastore:Datastore<Uint8Array> ):Promise<T|undefined> {
	if( node.prefixLength == null ) {
		if( !node.values ) throw missingValuesError(node);
		return Promise.resolve( node.values[valueName] );
	} else {
		const prefix = valueName.substr(0, node.prefixLength);
		if( !node.subBucketUris ) throw missingSubBucketUrisError(node)
		const subBucketUri = node.subBucketUris[prefix];
		if( subBucketUri == undefined ) return Promise.resolve(undefined);
		return fetchValue(valueName, subBucketUri, datastore);
	}
}

export function fetchValue<T>( valueName:string, nodeUri:string|DistributedBucketMap<T>, datastore:Datastore<Uint8Array> ):Promise<T|undefined> {
	if( typeof(nodeUri) === 'string' ) {
		return fetchNode(nodeUri, datastore).then( (obj:any) => {
			return _fetchValue(valueName, <DistributedBucketMap<T>>obj, datastore);
		});
	} else {
		return _fetchValue( valueName, <DistributedBucketMap<T>>nodeUri, datastore );
	}
}

//// Updating's a bit more complex

function updateValues<T>( original:KeyedList<T>, updates:KeyedList<T|undefined> ):KeyedList<T> {
	const clone : KeyedList<T> = { };
	for( let k in original ) clone[k] = original[k];
	for( let k in updates ) {
		const v = updates[k];
		if( v != undefined ) clone[k] = v;
		else delete clone[k];
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
	updates:KeyedList<T|undefined>, node:DistributedBucketMap<T>, nodeUri:string,
	datastore:Datastore<Uint8Array>, settings:DistributedBucketMapSettings
):Promise<string> {
	let newValues:KeyedList<T>;
	if( node.prefixLength == null ) {
		if( !node.values ) throw missingValuesError(node);
		let anythingChanged = false;
		for( let k in updates ) {
			const newVal = updates[k];
			if( node.values[k] != newVal ) anythingChanged = true;
		}
		if( !anythingChanged ) return Promise.resolve(nodeUri);
		
		node = leafNode(updateValues( node.values, updates ));
	} else {
		throw new Error("Updating non-leaf node not implemented");
	}
	
	// TODO: split up if violating size constraints
	
	// At this point, node is some mutable DistributedBucketMap
	// that we're going to mess with.
	return storeObject( node, datastore );
}

export function storeValues<T>(
	updates:KeyedList<T|undefined>, nodeUri:string,
	datastore:Datastore<Uint8Array>, settings:DistributedBucketMapSettings
):Promise<string> {
	return fetchNode( nodeUri, datastore ).then( (obj:any) => {
		return _storeValues(updates, <DistributedBucketMap<T>>obj, nodeUri, datastore, settings);
	});
}

export function emptyNodeUri( datastore:Datastore<Uint8Array> ):string {
	return fastStoreObject( EMPTY_NODE, datastore );
}

export class DistributedBucketMapManager<T> {
	/**
	 * A promise if updates are currently being written;
	 * null otherwise.
	 */
	protected currentUpdatePromise : Promise<string> | null;
	protected allUpdatesPromise : Promise<string>;
	protected storeSettings : DistributedBucketMapSettings;
	
	public constructor( protected _datastore:Datastore<Uint8Array>, protected _rootNodeUri:string=EMPTY_NODE_URI ) {
		this.allUpdatesPromise = Promise.resolve(_rootNodeUri);
	}

	public flushUpdates():Promise<string> {
		if( this.allUpdatesPromise ) return this.allUpdatesPromise;
		return Promise.resolve(this._rootNodeUri);
	}
	
	public get rootNodeUri() { return this._rootNodeUri; }

	protected pendingUpdates : KeyedList<T|undefined> = {};
	protected currentUpdates : KeyedList<T|undefined> = {};

	public fetchValue( k:string ):Promise<T|undefined> {
		if( this.pendingUpdates.hasOwnProperty(k) ) {
			return Promise.resolve(this.pendingUpdates[k]);
		}
		if( this.currentUpdates.hasOwnProperty(k) ) {
			return Promise.resolve(this.currentUpdates[k]);
		}
		return fetchValue(k, this._rootNodeUri, this._datastore);
	}

	public storeValues( updates:KeyedList<T|undefined> ):Promise<string> {
		for( let u in updates ) {
			 this.pendingUpdates[u] = updates[u];
		}

		// If there's already a currentUpdatePromise, it's already set to call storeUpdates
		// when it's done, so we don't need to do anything!
		if( this.currentUpdatePromise != null ) return this.currentUpdatePromise;
		
		// Otherwise we have to make currentUpdatePromise
		let storeUpdates : ()=>Promise<string>;
		storeUpdates = () => Promise.reject("xxx oh no"); // To trick compiler into letting me use it down below 
		storeUpdates = () => {
			let anyUpdates = false;
			for( let u in this.pendingUpdates ) {
				anyUpdates = true;
				break;
			}
			if( anyUpdates ) {
				this.currentUpdates = this.pendingUpdates;
				this.pendingUpdates = {};
				this.currentUpdatePromise = storeValues( this.currentUpdates, this._rootNodeUri, this._datastore, this.storeSettings ).then( (newRootNodeUri) => {
					this._rootNodeUri = newRootNodeUri;
					this.currentUpdates = {};
					return newRootNodeUri;
				});
				this.allUpdatesPromise = this.currentUpdatePromise.then(storeUpdates);
				return this.currentUpdatePromise;
			} else {
				this.currentUpdatePromise = null;
				return this.allUpdatesPromise = Promise.resolve(this._rootNodeUri);
			}
		}

		return storeUpdates();
	}
}
