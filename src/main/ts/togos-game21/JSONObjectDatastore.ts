import Datastore from './Datastore';
import ErrorInfo from './ErrorInfo';
import { utf8Encode, utf8Decode } from '../tshash/utils';

export function storeObject( v:any, datastore:Datastore<Uint8Array> ):Promise<string> {
	const json = JSON.stringify(v, null, "\t")+"\n";
	return datastore.store( utf8Encode(json) ).then( (dataurn) => dataurn+"#" );
}

export function fastStoreObject( v:any, datastore:Datastore<Uint8Array> ):string {
	const json = JSON.stringify(v, null, "\t")+"\n";
	return datastore.fastStore( utf8Encode(json) )+'#';
}

export function fetchObject( uri:string, datastore:Datastore<Uint8Array> ):Promise<any> {
	if( uri[uri.length-1] == '#' ) {
		return datastore.fetch( uri.substr(0, uri.length-1) ).then( (data:Uint8Array) => {
			const json:string = utf8Decode(data);
			return JSON.parse(json);
		});
	} else {
		return datastore.fetch(uri);
	}
}
