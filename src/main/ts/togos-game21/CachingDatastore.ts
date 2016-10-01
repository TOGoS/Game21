/// <reference path="../Promise.d.ts" />

import KeyedList from './KeyedList';
import ErrorInfo from './ErrorInfo';
import Datastore from './Datastore';

export default class CachingDatastore<T> implements Datastore<T> {
	constructor( protected identify:(v:T)=>string, protected cacheDs:Datastore<T>, protected fallbackDs:Datastore<T> ) { }

	public get( uri:string ):T|undefined {
		let v:T|undefined = this.cacheDs.get(uri);
		if( v == null ) {
			v = this.fallbackDs.get(uri);
			if( v != null ) {
				this.cacheDs.put(uri, v);
			}
		}
		return v;
	}
	public fetch( uri:string ):Promise<T> {
		return this.cacheDs.fetch(uri).catch( () => {
			return this.fallbackDs.fetch(uri).then( (v) => {
				this.cacheDs.put(uri, v);
				return v;
			});
		});
	}
	public store( data:T ):Promise<string> {
		const k = this.identify(data);
		return this.put(k, data);
	}
	public fastStore( data:T, onComplete?:(success:boolean, errorInfo?:ErrorInfo)=>void ):string {
		const ident = this.identify(data);
		const putProm = this.put(ident, data);
		if( onComplete ) {
			const onCompleat = onComplete;
			putProm.then( (id) => onCompleat(true), (err) => onCompleat(false, err) );
		}
		return ident;
	}
	public put( id:string, data:T ):Promise<string> {
		return Promise.all([
			this.cacheDs.put(id, data),
			this.fallbackDs.put(id, data)
		]).then( () => id );
	}
}
