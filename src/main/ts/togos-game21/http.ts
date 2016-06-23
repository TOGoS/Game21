/// <reference path="../Promise.d.ts" />
/// <reference path="../node.d.ts" />

import KeyedList from './KeyedList';

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
	content : Uint8Array;
}

export interface Response {
	statusCode : number;
	statusText : string;
	headers : KeyedList<string>;
	content : Uint8Array;
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
					console.log('resolving http request...');
					resolve( {
						statusCode: xhr.status,
						statusText: xhr.statusText,
						headers: {},
						content: new Uint8Array( <ArrayBuffer>xhr.response )
					} );
					console.log('resolved');
				}
			};
			xhr.open(request.method, request.uri, true);
			if( request.content ) xhr.send(request.content);
			else xhr.send();
		} );
	}
}

class NodeClient implements Client {
	public openRequest( request:Request ):Promise<Response> {
		return new Promise( (resolve,reject) => {
			const http = require('http');
			reject('NodeClient#openRequest not implemented!');
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

export function makeRequest( method:string, uri:string, headers:KeyedList<string>={}, content?:Uint8Array ):Request {
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
