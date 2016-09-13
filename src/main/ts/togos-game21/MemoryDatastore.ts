/// <reference path="../Promise.d.ts" />

import KeyedList from './KeyedList';
import ErrorInfo from './ErrorInfo';
import Datastore from './Datastore';

import { sha1Urn } from '../tshash/index';

export default class MemoryDatastore<T> implements Datastore<T> {
	protected values:KeyedList<T> = {};
	
	constructor( protected identify:(v:T)=>string, protected delay:number=0 ) { }

	public get( uri:string ):T {
		return this.values[uri];
	}
	public fetch( uri:string ):Promise<T> {
		return new Promise( (resolve,reject) => {
			setTimeout( () => {
				const val = this.values[uri];
				if( val ) resolve(val);
				else reject(new Error("Resource "+uri+" not found"));
			}, +this.delay );
		});
	}
	public store( data:T ):Promise<string> {
		return new Promise<string>( (resolve, reject) => {
			const ident = this.identify(data);
			setTimeout( () => {
				this.values[ident] = data;
				setTimeout( () => resolve(ident), this.delay );
			}, this.delay );
		});
	}
	public fastStore( data:T, onComplete?:(success:boolean, errorInfo?:ErrorInfo)=>void ):string {
		const ident = this.identify(data);
		const onCompleat = onComplete;
		setTimeout( () => {
			this.values[ident] = data;
			if(onCompleat) setTimeout( () => onCompleat(true), this.delay );
		}, this.delay );
		return ident;
	}
	
	public static createSha1Based(delay:number) : MemoryDatastore<Uint8Array> {
		return new MemoryDatastore<Uint8Array>( sha1Urn, delay );
	}
}
