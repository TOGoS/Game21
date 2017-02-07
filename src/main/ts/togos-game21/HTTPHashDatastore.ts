import ErrorInfo from './ErrorInfo';
import Datastore from './Datastore';
import { sha1Urn } from 'tshash';
import http from './http';

export default class HTTPHashDatastore implements Datastore<Uint8Array> {
	public static createDefault() {
		return new HTTPHashDatastore(sha1Urn, "http://game21-data.nuke24.net/uri-res/N2R");
	}
	
	constructor( protected _identify:(v:Uint8Array)=>string, protected n2rUrl:string ) {
	}
	
	public get identify() { return this._identify; }
	
	/** Returns the data if immediately available.  Otherwise returns null. */
	get( uri:string ):Uint8Array|undefined {
		return undefined; // We don't keep anything on hand
	}
	fetch( urn:string ):Promise<Uint8Array> {
		const url = this.n2rUrl+"?"+urn;
		return http.request('GET', url).then( (res) => {
			if( res.statusCode == 200 ) return Promise.resolve(res.content);
			else return Promise.reject(new Error("GET "+url+" returned "+res.statusCode));
		});
	}
	store( data:Uint8Array ):Promise<string> {
		const urn = this._identify(data);
		const url = this.n2rUrl+"?"+urn;
		let resProm = http.request('PUT', url, {}, data);
		return resProm.then( () => urn );
	}
	fastStore( data:Uint8Array, onComplete?:(success:boolean, errorInfo?:ErrorInfo)=>void ):string {
		const urn = this._identify(data);
		const putProm = this.put(urn, data);
		if( onComplete ) {
			const onCompleat = onComplete;
			putProm.then( (id) => onCompleat(true), (err) => onCompleat(false, err) );
		}
		return urn;
	}
	put( urn:string, data:Uint8Array ):Promise<string> {
		const url = this.n2rUrl+"?"+urn;
		return http.request('PUT', url, {}, data).then( (res) => {
			if( res.statusCode < 200 || res.statusCode >= 300 ) {
				return Promise.reject(new Error("Received status code "+res.statusCode+" from PUT to "+url));
			} else {
				return Promise.resolve(urn);
			}
		});
	}
}
