/// <reference path="../Promise.d.ts" />

import ErrorInfo from './ErrorInfo';

interface Datastore<T> {
	/** Returns the data if immediately available.  Otherwise returns null. */
	get( uri:string ):T|null;
	fetch( uri:string ):Promise<T>;
	store( data:T ):Promise<string>;
	/**
	 * Store the data, return its ID.
	 * The onComplete callback, if passed, will not be invoked until *after*
	 * this function returns.
	 */
	fastStore( data:T, onComplete?:(success:boolean, errorInfo?:ErrorInfo)=>void ):string;
}

export default Datastore;
