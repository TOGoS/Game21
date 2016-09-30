/// <reference path="../Promise.d.ts" />

import KeyedList from './KeyedList';
import ErrorInfo from './ErrorInfo';
import Datastore from './Datastore';

function fetchFrom<T>( uri:string, stores:Datastore<T>[], skip:number=0 ):Promise<T> {
	if( skip >= stores.length ) return Promise.reject(uri+" not found in any datastore.");
	return stores[skip].fetch( uri ).then( (got) => got, (error) => fetchFrom(uri, stores, skip+1) );
}

export default class MultiDatastore<T> implements Datastore<T> {
	protected values:KeyedList<T> = {};
	
	constructor( protected identify:(v:T)=>string, protected stores:Datastore<T>[] ) { }

	public get( uri:string ):T|undefined {
		for( let s in this.stores ) {
			const v = this.stores[s].get(uri);
			if( v != null ) return v;
		}
		return undefined;
	}
	public fetch( uri:string ):Promise<T> {
		return fetchFrom( uri, this.stores );
	}
	public store( data:T ):Promise<string> {
		if( this.stores.length == 0 ) return Promise.reject("No stores; can't store.");
		let storePromises:Promise<string>[] = [];
		for( let s in this.stores ) {
			storePromises.push( this.stores[s].store(data) );
		}
		// Maybe what we actually want is to return on first /success/.
		// Or require some number of successes.
		return Promise.race(storePromises);
	}
	public fastStore( data:T, onComplete?:(success:boolean, errorInfo?:ErrorInfo)=>void ):string {
		if( onComplete ) throw new Error("MultiDatastore#fastStore doesn't support onComplete!");
		const ident = this.identify(data);
		for( let s in this.stores ) {
			this.stores[s].fastStore(data);
		}
		return ident;
	}
}
