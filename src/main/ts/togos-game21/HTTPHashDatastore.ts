import Datastore from './Datastore';
import { sha1Urn } from '../tshash/index';

export default class HTTPHashDatastore implements Datastore {
	constructor( protected n2rUrl:string="http://game21-data.nuke24.net/uri-res/N2R" ) {
	}
	
	/** Returns the data if immediately available.  Otherwise returns null. */
	get( uri:string ):Uint8Array {
		return null; // We don't keep anything on hand
	}
	fetch( uri:string ):Promise<Uint8Array> {
		return null;
	}
	store( data:Uint8Array ):string {
		const urn = sha1Urn(data);
		const xhr = new XMLHttpRequest;
		xhr.onreadystatechange = () => {
			if( xhr.readyState == XMLHttpRequest.DONE ) {
				if( xhr.status >= 200 && xhr.status <= 300 ) {
					console.log("Successfully saved "+urn);
				} else {
					console.log("Save failed for "+urn+": "+xhr.statusText);
				}
			}
		};
		xhr.open("PUT", this.n2rUrl+"?"+urn, true);
		xhr.send(data);
		return urn;
	}
}

// Test!

import { utf8Encode } from '../tshash/index';

const data = utf8Encode("Hello, world!");
const ds = new HTTPHashDatastore;
console.log("Storing as "+ds.store(data));
