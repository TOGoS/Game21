/// <reference path="../Promise.d.ts" />

import ErrorInfo from './ErrorInfo';

interface Datastore<T> {
	identify : (v:T)=>string;
	/** Returns the data if immediately available.  Otherwise returns null. */
	get( uri:string ):T|undefined;
	/** Initiates fetching and returns a promise.  The promise will be rejected if thing isn't found. */
	fetch( uri:string ):Promise<T>;
	store( data:T ):Promise<string>;
	/**
	 * Store the data, return its ID.
	 * The onComplete callback, if passed, will not be invoked until *after*
	 * this function returns.
	 */
	fastStore( data:T, onComplete?:(success:boolean, errorInfo?:ErrorInfo)=>void ):string;
	/**
	 * When you already know the ID, or for datastores that can store any old pairing.
	 * The returned promise's value must be the same ID that was passed to #put.
	 */
	put( id:string, data:T ):Promise<string>;
}

export default Datastore;
