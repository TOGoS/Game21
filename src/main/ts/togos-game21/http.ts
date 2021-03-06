/// <reference path="../Promise.d.ts" />
/// <reference path="../node.d.ts" />

import ErrorInfo from './ErrorInfo';
import KeyedList from './KeyedList';
import { IncomingMessage } from 'http';
import { utf8Encode } from 'tshash/utils';

/**
 * HTTP abstraction layer.
 * Because node doesn't support XMLHttpRequest.
 * Also because promises are nice.
 * 
 * This is designed to handle small bits of data, hence passing Uint8Arrays.
 * If we need to handle larger things,
 * this should at that point be refactored to use Blobs or something.
 */

export interface Request {
	method : string;
	uri : string;
	headers : KeyedList<string>;
	content? : Uint8Array|null;
}

export interface Response {
	statusCode : number;
	statusText : string;
	headers : KeyedList<string>;
	content? : Uint8Array|null;
}

export interface Client {
	openRequest( request:Request ):Promise<Response>;
}

class XHRClient implements Client {
	public openRequest( request:Request ):Promise<Response> {
		return new Promise( (resolve,reject) => {
			const xhr = new XMLHttpRequest;
			xhr.responseType = 'arraybuffer';
			xhr.onreadystatechange = () => {
				if( xhr.readyState == XMLHttpRequest.DONE ) {
					resolve( {
						statusCode: xhr.status,
						statusText: xhr.statusText,
						headers: {},
						content: new Uint8Array( <ArrayBuffer>xhr.response )
					} );
				}
			};
			xhr.open(request.method, request.uri, true);
			for( let k in request.headers ) {
				xhr.setRequestHeader(k, request.headers[k]);
			}
			if( request.content ) xhr.send(request.content);
			else xhr.send();
		} );
	}
}

function arrayToBuffer( arr:Uint8Array ):Buffer {
	const buf = new Buffer(arr.length);
	for( let i=arr.length-1; i>=0; --i ) buf[i] = arr[i];
	return buf;
}

class NodeClient implements Client {
	public openRequest( request:Request ):Promise<Response> {
		return new Promise( (resolve,reject) => {
			const HTTP = require('http');
			const URL = require('url');
			const parsedUrl = URL.parse(request.uri);
			const req = HTTP.request( {
				hostname: parsedUrl.hostname,
				port: parsedUrl.port,
				path: parsedUrl.path,
				method: request.method,
				headers: request.headers,
			}, (res : IncomingMessage) => {
				const buffers:(Buffer|Uint8Array)[] = [];
				res.setEncoding(null);
				res.on('data', (d : Buffer|Uint8Array) => {
					if( typeof(d) == 'string' ) {
						// ugh y this happen 2 me
						// hacky worxakround ;;((
						d = utf8Encode(d);
					}
					buffers.push(d)
				});
				res.on('end', () => {
					const data:Uint8Array = new Uint8Array( buffers.reduce( (len:number,buf:Buffer) => len + buf.length, 0 ) );
					for( let i=0, b=0; b<buffers.length; ++b ) {
						const buf = buffers[b];
						for( let j=0; j<buf.length; ++j, ++i ) {
							data[i] = buf[j];
						}
					}
					resolve( {
						statusCode: res.statusCode,
						statusText: res.statusMessage,
						headers: res.headers,
						content: data
					} );
				} );
			} );
			req.on('error', (e:ErrorInfo) => reject(e));
			if( request.content ) req.write(arrayToBuffer(request.content));
			req.end();
		});
	}
}

function makeClient() {
	if( typeof(XMLHttpRequest) != 'undefined' ) return new XHRClient();
	
	if( typeof(require) != 'undefined' ) {
		try {
			require.resolve('http');
			return new NodeClient();
		} catch(e) { }
	}
	
	throw new Error("No XMLHttpRequest or require('http'); can't consturct http client.");
}

let _client : Client;
export function getClient() {
	if( !_client ) _client = makeClient();
	return _client;
}

export function makeRequest( method:string, uri:string, headers:KeyedList<string>={}, content?:Uint8Array|null ):Request {
	return { method: method, uri: uri, headers: headers, content: content };
}

export function request( method:string, uri:string, headers:KeyedList<string>={}, content?:Uint8Array ):Promise<Response> {
	return getClient().openRequest( makeRequest(method, uri, headers, content) );
}

export default {
	request: request,
	makeRequest: makeRequest,
	getClient: getClient,
}
