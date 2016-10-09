/// <reference path="../Promise.d.ts" />

import KeyedList from './KeyedList';
import ErrorInfo from './ErrorInfo';
import Datastore from './Datastore';

import { sha1Urn } from '../tshash/index';

export default class MemoryDatastore<T> implements Datastore<T> {
	protected _values:KeyedList<T> = {};
	
	constructor( protected _identify:(v:T)=>string, protected delay:number=0 ) { }
	
	public get identify() { return this._identify; }
	
	public get( uri:string ):T {
		return this._values[uri];
	}
	public fetch( uri:string ):Promise<T> {
		return new Promise( (resolve,reject) => {
			setTimeout( () => {
				const val = this._values[uri];
				if( val ) resolve(val);
				else reject(new Error("Resource "+uri+" not found"));
			}, +this.delay );
		});
	}
	public store( data:T ):Promise<string> {
		return new Promise<string>( (resolve, reject) => {
			const ident = this._identify(data);
			setTimeout( () => {
				this._values[ident] = data;
				setTimeout( () => resolve(ident), this.delay );
			}, this.delay );
		});
	}
	public fastStore( data:T, onComplete?:(success:boolean, errorInfo?:ErrorInfo)=>void ):string {
		const ident = this._identify(data);
		const onCompleat = onComplete;
		setTimeout( () => {
			this._values[ident] = data;
			if(onCompleat) setTimeout( () => onCompleat(true), this.delay );
		}, this.delay );
		return ident;
	}
	public put( id:string, data:T ):Promise<string> {
		this._values[id] = data;
		return Promise.resolve(id);
	}
	public multiPut( vals:KeyedList<T> ):void {
		for( let v in vals ) {
			this.values[v] = vals[v];
		}
	}
	public get values() {
		return this._values;
	}
	
	public static createSha1Based(delay:number) : MemoryDatastore<Uint8Array> {
		return new MemoryDatastore<Uint8Array>( sha1Urn, delay );
	}
}
