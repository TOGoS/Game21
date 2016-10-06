import { deepFreeze } from './DeepFreezer';
import Datastore from './Datastore';
import ErrorInfo from './ErrorInfo';
import { utf8Encode, utf8Decode } from '../tshash/utils';
import PrettierJSONEncoder from './PrettierJSONEncoder';

function stringify(v:any):string {
	//return JSON.stringify(v);
	return PrettierJSONEncoder.stringify(v);
}

function encodeObject(obj:any):Uint8Array {
	return utf8Encode(stringify(obj));
}

function dataUrnToSubjectUrn(urn:string):string {
	return urn+"#";
}

export function identifyObject( v:any, identifyData:(v:Uint8Array)=>string ):string {
	return dataUrnToSubjectUrn(identifyData(encodeObject(v)));
}

export function storeObject( v:any, datastore:Datastore<Uint8Array> ):Promise<string> {
	if( v instanceof Uint8Array ) {
		return datastore.store(v);
	}
	return datastore.store(encodeObject(v)).then( (dataUrn) => dataUrnToSubjectUrn(dataUrn) );
}

export function fastStoreObject<T>( v:T, datastore:Datastore<Uint8Array> ):string {
	if( v instanceof Uint8Array ) {
		return datastore.fastStore(v);
	}
	return dataUrnToSubjectUrn(datastore.fastStore(encodeObject(v)));
}

export function fetchObject( uri:string, datastore:Datastore<Uint8Array>, freeze:boolean=false ):Promise<any> {
	if( uri[uri.length-1] == '#' ) {
		return datastore.fetch( uri.substr(0, uri.length-1) ).then( (data:Uint8Array) => {
			const json:string = utf8Decode(data);
			const obj = JSON.parse(json);
			return freeze ? deepFreeze(obj, true) : obj;
		});
	} else {
		// Can't deepfreeze Uint8Arrays or I would.  ;(
		// But they're less likely to get munged anyway.
		return datastore.fetch(uri);
	}
}
