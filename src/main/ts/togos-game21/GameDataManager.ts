///<reference path="../Promise.d.ts"/>

import Datastore from './Datastore';
import KeyedList from './KeyedList';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import { utf8Encode } from '../tshash/utils';

export class GameDataManager {
	protected objectMapManager: DistributedBucketMapManager<string>;
	protected datastore: Datastore<Uint8Array>;
	protected objectCache: KeyedList<any> = {}

	public getObject<T>( ref:string, initiateFetch:boolean=false ):T|undefined {
		const v = this.objectCache[ref];
		return v;
	}

	public fetchObject<T>( ref:string ):Promise<T> {
		return Promise.reject(new Error("fetchObject not implemented ha ha ha"));
	}

	protected updateMap( updates:KeyedList<string> ):void {
		this.objectMapManager.storeValues( updates );
	}
	
	public fastStoreObject( obj:any, name?:string ):string {
		const json = JSON.stringify(obj, null, "\t")+"\n";
		const urn = this.datastore.fastStore( utf8Encode(json) );
		if( name ) this.updateMap( {name: urn} );
		return urn;
	}
}
