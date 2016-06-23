/// <reference path="../Promise.d.ts" />

import ErrorInfo from './ErrorInfo';

interface Datastore<T> {
	/** Returns the data if immediately available.  Otherwise returns null. */
	get( uri:string ):T;
	fetch( uri:string ):Promise<T>;
	store( data:T, onComplete?:(success:boolean, errorInfo?:ErrorInfo)=>void ):string;
}

export default Datastore;
