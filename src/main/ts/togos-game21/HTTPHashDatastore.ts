import Datastore from './Datastore';
import { sha1Urn } from '../tshash/index';
import http from './http';

export default class HTTPHashDatastore implements Datastore<Uint8Array> {
	constructor( protected n2rUrl:string="http://game21-data.nuke24.net/uri-res/N2R" ) {
	}
	
	/** Returns the data if immediately available.  Otherwise returns null. */
	get( uri:string ):Uint8Array {
		return null; // We don't keep anything on hand
	}
	fetch( uri:string ):Promise<Uint8Array> {
		return null;
	}
	store( data:Uint8Array, onComplete?:(success:boolean, errorInfo:any)=>void ):string {
		const urn = sha1Urn(data);
		http.request('PUT', this.n2rUrl+"?"+urn, {}, data);
		// TODO: Call onComplete callback
		return urn;
	}
}
