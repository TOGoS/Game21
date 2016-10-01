import KeyedList from './KeyedList';
import ErrorInfo from './ErrorInfo';
import Datastore from './Datastore';

import { utf8Encode, utf8Decode, hexEncode, hexDecode } from '../tshash/utils';

export default class BrowserStorageDatastore implements Datastore<Uint8Array> {
	public constructor(protected identify:(v:Uint8Array)=>string, protected browserStorage:Storage) { }

	/** Returns the data if immediately available.  Otherwise returns null. */
	public get( uri:string ):Uint8Array|undefined {
		const str = this.browserStorage.getItem(uri);
		if( str ) console.log("Found "+uri+": "+str);
		if( str != null ) return utf8Encode(str);

		const hex = this.browserStorage.getItem("hex-encode:"+uri);
		if(hex) console.log("Found hex-encoded:"+uri+": "+hex);
		if( hex != null ) return hexDecode(hex);
		
		return undefined;
	}
	public fetch( uri:string ):Promise<Uint8Array> {
		const data = this.get(uri);
		return data == null ? Promise.reject(new Error(uri+" not found in BrowserStorageDatastore")) : Promise.resolve(data);
	}
	public store( data:Uint8Array ):Promise<string> {
		return Promise.resolve(this.fastStore(data));
	}
	/**
	 * Store the data, return its ID.
	 * The onComplete callback, if passed, will not be invoked until *after*
	 * this function returns.
	 */
	public fastStore( data:Uint8Array, onComplete?:(success:boolean, errorInfo?:ErrorInfo)=>void ):string {
		if( onComplete ) throw new Error("onComplete not supported by BrowserStorageDatastore#fastStore");
		const id = this.identify(data);
		this.fastPut(id, data);
		return id;
	}

	protected utf8Decode(data:Uint8Array):string|undefined {
		try {
			const decoded = utf8Decode(data);
			const reencoded = utf8Encode(decoded);
			if( reencoded.length != data.length ) return undefined;
			for( let i=0; i<data.length; ++i ) {
				if( data[i] != reencoded[i] ) return undefined;
			}
			console.log("Data (length "+data.length+" utf-8-decoded-encoded just fine! "+decoded);
			return decoded;
		} catch( err ) {
			return undefined;
		}
	}

	fastPut( id:string, data:Uint8Array ) {
		const utf8Decoded = this.utf8Decode(data);
		if( utf8Decoded != null ) {
			console.log("Storing "+id+" utf-8-encoded");
			this.browserStorage.setItem(id, utf8Decoded);
		} else {
			console.log("Storing "+id+" hex-encoded");
			this.browserStorage.setItem("hex-encode:"+id, hexEncode(data));
		}
	}
}