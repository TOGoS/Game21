/// <reference path="../Promise.d.ts" />

import KeyedList from './KeyedList';

/**
 * HTTP abstraction layer.
 * Because node doesn't support XMLHttpRequest.
 * Also because promises are nice.
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

class XHRClient implements Client{
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

function makeClient() {
	if( XMLHttpRequest ) {
		return new XHRClient();
	} else {
		throw new Error("No XMLHttpRequest; can't consturct http client.");
	}
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
