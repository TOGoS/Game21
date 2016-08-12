/// <reference path="./node.d.ts"/>
/// <reference path="./express.d.ts"/>

interface WebSocketLike {
	binaryType : string;
	send(data:string|ArrayBuffer):void;
	onopen : (event:any)=>void;
	onerror : (event:any)=>void;
	onclose : (event:any)=>void;
	onmessage : (event:any)=>void;
}

declare module 'ws' {
	import * as http from 'http';
	import * as express from 'express';
	
	interface ServerOpts {
		server: http.Server
	}
	
	class WebSocket implements WebSocketLike {
		public upgradeReq: express.Request; // It's some kind of HTTP request object

		public binaryType : string;
		public send(data:string|ArrayBuffer):void;
		public onopen : (event:any)=>void;
		public onerror : (event:any)=>void;
		public onclose : (event:any)=>void;
		public onmessage : (event:any)=>void;
		
		public on(eventName:'message', listener:(data:any)=>void ):void;
	}
	
	class Server {
		constructor( opts:ServerOpts );
		
		public on( event:"message", listener:(data:any)=>void ):void;
	}
}
