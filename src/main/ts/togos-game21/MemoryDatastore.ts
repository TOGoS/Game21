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
	public store( data:T, onComplete?:(success:boolean, errorInfo?:ErrorInfo)=>void ):string {
		const ident = this.identify(data);
		if( this.delay >= 0 ) {
			setTimeout( () => {
				this.values[ident] = data;
				if(onComplete) setTimeout( () => onComplete(true) );
			}, this.delay );
		} else {
			this.values[ident] = data;
			if( onComplete ) onComplete(true);
		}
		return ident;
	}
	
	public static createSha1Based(delay:number) : MemoryDatastore<Uint8Array> {
		return new MemoryDatastore<Uint8Array>( sha1Urn, delay );
	}
}
