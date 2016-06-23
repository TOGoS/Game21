/// <reference path="../node.d.ts"/>

import KeyedList from './KeyedList';
import IP6Address, {parseIp6Address, stringifyIp6Address} from './IP6Address';
import WebSocketLike from './WebSocketLike';
import WSWebSocket from './WSWebSocket';
import {Request as ExpressRequest, Response as ExpressResponse} from './express';

type LinkID = string;

interface IPPacketInfo<T> {
	ipVersion:number;
	sourceAddressString:string;
	destAddressString:string;
	subProtocolNumber:number;
	payloadObject:T
}

class IP6Prefix {
	public address:IP6Address;
	public length:number; // Of bits of prefix, e.g. 64
	constructor(address:IP6Address, length:number) {
		if( length % 8 != 0 ) throw new Error("Non-multiple-of-8 prefix length is unsupported by IP6Prefix constructor!");
		this.address = new Uint8Array(length*8);
		this.length = length;
		for( let i=0; i<(length/8); ++i ) {
			this.address[i] = address[i];
		} // Rest are zeroes!
	}
	
	public toString():string {
		return stringifyIp6Address(this.address)+"/"+length;
	}
	
	public matches(addr:IP6Address):boolean {
		if( this.length % 8 != 0 ) throw new Error("Non-multiple-of-8 prefix length is unsupported by IP6Prefix#matches!");
		for( let i:number=0; i<(this.length/8); ++i ) {
			if( this.address[i] != addr[i] ) return false;
		}
		return true;
	}
}

class Route {
	constructor(public prefix:IP6Prefix, public linkId:LinkID) { }
}

class RouteList {
	public routesByPrefixLength:Array<KeyedList<Route>> = [];
	
	constructor() {
		for( let i=0; i <= 128; ++i ) {
			this.routesByPrefixLength[i] = {};
		}
	}
	
	public push(route:Route) {
		let routeList = this.routesByPrefixLength[route.prefix.length]
		routeList[route.prefix.toString()] = route;
	}
	public removePrefix(prefix:IP6Prefix) {
		let routeList = this.routesByPrefixLength[prefix.length]
		delete routeList[prefix.toString()];
	}
	
	public route(addr:IP6Address):LinkID {
		for( let prefixLength = 128; prefixLength >= 0; --prefixLength ) {
			const routes = this.routesByPrefixLength[prefixLength];
			for( const r in routes ) {
				const route = routes[r];
				if( route.prefix.matches(addr) ) return route.linkId;
			}
		}
		// If there is a default route (anything in ::/0 ), then it should have been returned already.
		return null;
	}
};

abstract class Link {
	// public prefixes:KeyedList<IP6Prefix> = {};
	abstract attached(router:Router, name:LinkID):void;
	abstract detached(router:Router, name:LinkID):void;
	abstract send<T>(packetInfo:IPPacketInfo<T>):void;
}

interface WebSocketServer {
	on<EventType>(eventName:string, callback:(event:EventType)=>void ):void;
}

class WebSocketLink extends Link {
	constructor(protected conn:WebSocketLike) {
		super();
	}
	public attached(router:Router, name:LinkID) { }
	public detached(router:Router, name:LinkID) { }
	public send<T>(packetInfo:IPPacketInfo<T>) {
		this.conn.send(JSON.stringify(packetInfo));
	}
}

function getRequestClientAddress(req:ExpressRequest) {
	return req.ip || req.connection.remoteAddress;
}

class Router {
	public routes:RouteList = new RouteList;
	public links:KeyedList<Link> = {};
	//public nextClientAddress:
	public networkPrefix:IP6Prefix = new IP6Prefix(parseIp6Address("1234:0:0:1::"),64);
	public routerAddress:IP6Address = parseIp6Address("1234:0:0:1::1");
	protected nextLinkId = 1;
	
	protected newLinkId():LinkID {
		return "l"+(this.nextLinkId++);
	}
	
	public addLink(link:Link, linkId:LinkID=this.newLinkId()) {
		this.links[linkId] = link;
		link.attached(this, linkId);
	}
	
	public removeLink(linkId:LinkID) {
		const link = this.links[linkId];
		if( link != null ) link.detached(this, linkId);
		delete this.links[linkId];
	}
	
	public messageReceived<T>(packetInfo:IPPacketInfo<T>, sourceLinkId:LinkID) {
		let destAddress:Uint8Array;
		if( typeof(packetInfo.destAddressString) === 'string' ) {
			destAddress = parseIp6Address(packetInfo.destAddressString);
		} else {
			console.log("packetInfo.destAddressString not a string; packetInfo = "+JSON.stringify(packetInfo));
			return;
		}
		const destLinkId:LinkID = this.routes.route(destAddress);
		if( destLinkId == null ) {
			console.log("Packet could not be routed; no route for "+stringifyIp6Address(destAddress));
			return;
		}
		const destLink = this.links[destLinkId];
		if( destLink == null ) {
			console.log("Packet could not be routed to "+stringifyIp6Address(destAddress)+"; link '"+destLinkId+"' does not exist.");
			return;
		}
		console.log("Routing packet from "+packetInfo.sourceAddressString+" to "+stringifyIp6Address(destAddress));
		destLink.send(packetInfo);
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
			const ws = <WSWebSocket>_ws;
			
			console.log("Received WebSocket connection from "+getRequestClientAddress(ws.upgradeReq));
			
			const location = URL.parse(ws.upgradeReq.url, true);
			const linkId = this.newLinkId();
			const link = new WebSocketLink(ws);
			
			// you might use location.query.access_token to authenticate or share sessions
			// or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)
			
			ws.on('message', data => {
				console.log("Received WebSocket message from "+linkId);
				
				let packetInfo:IPPacketInfo<any>;
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
			
			link.send({
				ipVersion: 6,
				destAddressString: "ff02::1:3",
				sourceAddressString: stringifyIp6Address(this.routerAddress),
				subProtocolNumber: 58,
				payloadObject: {
					type: 134, // router advertisement
					options: [
						{
							type: 3, // prefix information
							prefix: {
								length: this.networkPrefix.length,
								addressString: stringifyIp6Address(this.networkPrefix.address)
							}
						}
					]
				}
			});
		});
		
		const exrpessApp = Express();
		exrpessApp.use(function (req:ExpressRequest, res:ExpressResponse) {
			res.send("Hi.  Maybe you want to Upgrade: websocket?");
		});
		httpServer.on('request', exrpessApp);
		httpServer.listen(port, function () { console.log('Listening on ' + httpServer.address().port) });
	}
}

new Router().start();
