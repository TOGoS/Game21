/// <reference path="../Promise.d.ts" />
//import Promise from '../Promise';

interface Datastore {
	/** Returns the data if immediately available.  Otherwise returns null. */
	get( uri:string ):Uint8Array;
	fetch( uri:string ):Promise<Uint8Array>;
	store( data:Uint8Array ):string;
}

export default Datastore;
