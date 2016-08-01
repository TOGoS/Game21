import ErrorInfo from './ErrorInfo';
import Datastore from './Datastore';
import { sha1Urn } from '../tshash/index';
import http from './http';

export default class HTTPHashDatastore implements Datastore<Uint8Array> {
	constructor( protected n2rUrl:string="http://game21-data.nuke24.net/uri-res/N2R" ) {
	}
	
	/** Returns the data if immediately available.  Otherwise returns null. */
	get( uri:string ):Uint8Array|null {
		return null; // We don't keep anything on hand
	}
	fetch( urn:string ):Promise<Uint8Array> {
		const url = this.n2rUrl+"?"+urn;
		return http.request('GET', url).then( (res) => {
			if( res.statusCode == 200 ) return res.content;
			else return Promise.reject(new Error("GET "+url+" returned "+res.statusCode));
		});
	}
	store( data:Uint8Array, onComplete?:(success:boolean, errorInfo?:ErrorInfo)=>void ):string {
		const urn = sha1Urn(data);
		const url = this.n2rUrl+"?"+urn;
		let resProm = http.request('PUT', url, {}, data)
		const onCompleat = onComplete;
		if( onCompleat ) resProm.then( (res) => {
			if( res.statusCode < 200 || res.statusCode >= 300 ) {
				onCompleat( false, new Error("Received status code "+res.statusCode+" from PUT to "+url) );
			} else {
				onCompleat( true );
			}
		}).catch( (err) => {
			onCompleat( false, err );
		})
		return urn;
	}
}
