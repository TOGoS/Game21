/// <reference path="../Promise.d.ts" />

import KeyedList from './KeyedList';
import ErrorInfo from './ErrorInfo';
import Datastore from './Datastore';

export default class MemoryDatastore<T> implements Datastore<T> {
	protected values:KeyedList<T> = {};
	
	constructor( protected identify:(v:T)=>string, protected ds:Datastore<T> ) { }

	public get( uri:string ):T|undefined {
		let v:T|undefined = this.values[uri];
		if( v == null ) {
			v = this.ds.get(uri);
			if( v != null ) this.values[uri] = v;
		}
		return v;
	}
	public fetch( uri:string ):Promise<T> {
		if( this.values[uri] ) return Promise.resolve(this.values[uri]);
		return this.ds.fetch(uri).then( (v) => {
			this.values[uri] = v;
			return v;
		});
	}
	public store( data:T ):Promise<string> {
		const k = this.identify(data);
		this.values[k] = data;
		return this.ds.store(data);
	}
	public fastStore( data:T, onComplete?:(success:boolean, errorInfo?:ErrorInfo)=>void ):string {
		const ident = this.identify(data);
		this.values[ident] = data;
		this.ds.fastStore( data, onComplete );
		return ident;
	}
}
