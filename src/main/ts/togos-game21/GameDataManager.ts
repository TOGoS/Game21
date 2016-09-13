///<reference path="../Promise.d.ts"/>

import { deepFreeze } from './DeepFreezer';
import Datastore from './Datastore';
import KeyedList from './KeyedList';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import { utf8Encode } from '../tshash/utils';
import { fetchObject, storeObject, fastStoreObject } from './JSONObjectDatastore';
import { shortcutThen, value as promiseValue } from './promises';

const hashUrnRegex = /^urn:(sha1|bitprint):.*/;

export default class GameDataManager {
	protected objectMapManager: DistributedBucketMapManager<string>;
	protected datastore: Datastore<Uint8Array>;
	protected objectCache: KeyedList<any> = {};
	/**
	 * Stuff we're currently storing.
	 * Generally we don't want to let stuff fall out of the cache
	 * if we're still storing it, since that could result in fetch
	 * returning an outdated value!
	 */
	protected storing: KeyedList<boolean> = {};
	protected fetching: KeyedList<Promise<any>> = {};
	
	public constructor( ds:Datastore<Uint8Array>, omm:DistributedBucketMapManager<string> ) {
		this.datastore = ds;
		this.objectMapManager = omm;
	}
	
	public getObject<T>( ref:string, initiateFetch:boolean=false ):T|undefined {
		const v = this.objectCache[ref];
		if( v == null && initiateFetch && !this.fetching[ref] ) this.fetchObject(ref);
		return v;
	}
	
	protected cache<T>( k:string, v:T ):void {
		this.objectCache[k] = v;
	}
	
	public fetchObject<T>( ref:string ):Promise<T> {
		if( this.objectCache[ref] ) return Promise.resolve(this.objectCache[ref]);
		if( this.fetching[ref] ) return this.fetching[ref];
		
		if( hashUrnRegex.exec(ref) ) {
			return this.fetching[ref] = fetchObject(ref, this.datastore, true).then( (v:any) => {
				this.cache(ref, v);
				delete this.fetching[ref];
				return <T>v;
			});
		} else {
			return this.fetching[ref] = this.objectMapManager.fetchValue(ref).then( (realRef:string) => {
				if( realRef == null ) {
					return Promise.reject("No mapping for "+ref);
				} else {
					return this.fetchObject(realRef).then( (v:any) => {
						this.cache(ref, v);
						delete this.fetching[ref];
						return <T>v;
					});
				}
			});
		}
	}
	
	public clearCache():void {
		// Well, might not want to clear stuff out that we're in the process of storing.
		// But maybe we do if explicitly asked to clearCache().  *shrug*
		this.objectCache = {};
	}
	
	protected updateMap( updates:KeyedList<string> ):Promise<string> {
		return this.objectMapManager.storeValues( updates );
	}
	
	public storeObject( obj:any, _name?:string ):Promise<string> {
		obj = deepFreeze(obj);
		const urnProm = storeObject( obj, this.datastore );
		const name = _name; // Make it const so later references check out
		if( name ) {
			this.objectCache[name] = obj;
			this.storing[name] = true;
			return urnProm.then( (urn) => {
				return this.updateMap({[name]: urn}).then( (newMapUrn) => {
					delete this.storing[name];
					return urn;
				});
			});
		} else return urnProm;
	}
	
	public fastStoreObject( obj:any, _name?:string ):string {
		obj = deepFreeze(obj);
		const urn = fastStoreObject( obj, this.datastore );
		this.objectCache[urn] = obj;
		// Uhm, how can we set this.storing[urn] and then have it get cleared, uhm
		const name = _name;
		if( name ) {
			this.objectCache[name] = obj;
			this.storing[name] = true;
			this.updateMap({[name]: urn}).then( (newMapUrn) => {
				delete this.storing[name];
			});
		}
		return urn;
	}
}
