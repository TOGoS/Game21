/// <reference path="node.d.ts"/>

import KeyedList from './KeyedList';

class IP6Prefix {
	constructor(public address:Uint8Array, public length:number) { }
}

abstract class Link {
	public prefixes:KeyedList<IP6Prefix> = {};
	abstract attached(router:Router, name:String);
	abstract detached(router:Router, name:String);
	abstract send(packetInfo:any);
}

interface WebSocketServer {
	on<EventType>(eventName:string, callback:(event:EventType)=>void );
}

interface ExpressRequest {
	url:string;
	ip:string;
	connection;
}

interface WebSocket {
	upgradeReq:ExpressRequest; // It's some kind of HTTP request object
	send(data:string|ArrayBuffer);
	on(eventName:string, callback:(event)=>void );
}

class WebSocketLink extends Link {
	constructor(protected conn:WebSocket) {
		super();
	}
	public attached(router:Router, name:String) { }
	public detached(router:Router, name:String) { }
	public send(packetInfo:any) {
		this.conn.send(JSON.stringify(packetInfo));
	}
}

function getRequestClientAddress(req:ExpressRequest) {
	return req.ip || req.connection.remoteAddress;
}

class Router {
	public links:KeyedList<Link>;
	protected nextLinkId = 1;
	
	protected newLinkId():string {
		return "l"+(this.nextLinkId++);
	}
	
	public addLink(link:Link, linkId:string=this.newLinkId()) {
		this.links[linkId] = link;
		link.attached(this, linkId);
	}
	
	public removeLink(linkId:string) {
		const link = this.links[linkId];
		if( link != null ) link.detached(this, linkId);
		delete this.links[linkId];
	}
	
	public messageReceived(packetInfo:Object, sourceLinkId:string) {
		console.log("Received packet", packetInfo);
	}
	
	public start() {
		// Copied from the ws readme: https://github.com/websockets/ws
		const httpServer = require('http').createServer();
		const	URL = require('url');
		const WebSocketServer = require('ws').Server;
		const Express = require('express');
		
		const webSocketServer = <WebSocketServer>new WebSocketServer({ server: httpServer });
		const port = 4080;
		
		webSocketServer.on('connection', _ws => {
			const ws = <WebSocket>_ws;
			
			console.log("Received WebSocket connection from "+getRequestClientAddress(ws.upgradeReq));
			
			const location = URL.parse(ws.upgradeReq.url, true);
			const linkId = this.newLinkId();
			const link = new WebSocketLink(ws);
			
			// you might use location.query.access_token to authenticate or share sessions
			// or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
			
			ws.on('message', data => {
				console.log("Received WebSocket message from "+linkId);
				
				let packetInfo;
				if( typeof data == "string" ) {
					try {
						packetInfo = JSON.parse(data);
					} catch( e ) {
						console.log("Received invalid JSON? "+data);
						return;
					}
				} else {
					console.log("Received non-string from WebSocket link");
					return;
				}
				
				this.messageReceived(packetInfo, linkId);
			});
		});
		
		const exrpessApp = Express();
		exrpessApp.use(function (req, res) {
			res.send("Hi.  Maybe you want to Upgrade: websocket?");
		});
		httpServer.on('request', exrpessApp);
		httpServer.listen(port, function () { console.log('Listening on ' + httpServer.address().port) });
	}
}

new Router().start();
