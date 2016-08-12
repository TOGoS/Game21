/**
 * Command-line program that starts a Router
 * and allows you to manage it via command-line arguments.
 */

// Node stuff
/// <reference path="../../node.d.ts"/>
/// <reference path="../../express.d.ts"/>
/// <reference path="../../ws.d.ts"/>


import {
	Server as HTTPServer,
	createServer as createHttpServer
} from 'http';
import {
	createSocket as createDgramSocket,
	Socket as DgramSocket,
	RemoteInfo
} from 'dgram';
import {
	Request as ExpressRequest,
	Response as ExpressResponse,
	App as ExpressApp,
	AppCreationFunction as ExpressAppCreationFunction
} from 'express';
const createExpressApp = <ExpressAppCreationFunction>require('express');
import { WebSocket, Server as WebSocketServer } from 'ws';
import { parse as parseUrl } from 'url';

import { utf8Encode } from '../../tshash/utils';
import Router, { LinkID, Link, PacketHandler } from '../inet/Router';
import {
	parseIp6Address
} from '../inet/IP6Address';

function setExitCode( c:number ):void {
	if( typeof(process) == 'object' ) process.exitCode = c;
}

class WebSocketLink implements Link {
	protected handler? : PacketHandler;
	
	constructor(protected conn:WebSocketLike) {
		conn.onmessage = (messageEvent:MessageEvent) => {
			if( !this.handler ) return;
			
			let data = messageEvent.data;
			
			if( data instanceof Uint8Array ) {
			} else if( data instanceof ArrayBuffer ) {
				data = new Uint8Array(data);
			} if( ArrayBuffer.isView(data) ) {
				data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
			} else if( typeof data == 'string' ) {
				data = utf8Encode(data);
			} else {
				console.error("Received weird data from websocket.");
				return;
			}
			
			this.handler(data);
		};
	}
	
	/*
	public attached(router:Router, name:LinkID) { }
	public detached(router:Router, name:LinkID) { }
	public send<T>(packetInfo:IPPacketInfo<T>) {
		this.conn.send(JSON.stringify(packetInfo));
	}
	*/

	public send( packet:Uint8Array ) {
		this.conn.send( packet );
	}
	
	public setUp( handler : PacketHandler ) {
		this.handler = handler;
	}
	
	public setDown() {
		this.handler = undefined;
	}
}

class UDPTunnelLink implements Link {
	protected tunnelAddress? : string;
	protected tunnelPort? : number;
	protected handler? : PacketHandler;
	
	public constructor( protected sock : DgramSocket ) {
		sock.on('message', (msg:Buffer, rinfo:RemoteInfo) => {
			// TODO: only if set to dynamically
			// accept connections
			this.tunnelAddress = rinfo.address;
			this.tunnelPort = rinfo.port;
			if( this.handler ) this.handler(msg);
		});
	}
	
	public send( packet:Uint8Array ) {
		const buf = new Buffer(packet); // This actually makes a copy, which I don't want
		if( this.tunnelAddress && this.tunnelPort ) {
			this.sock.send( buf, 0, buf.length, this.tunnelPort, this.tunnelAddress );
		}
	}
	
	public setUp( handler : PacketHandler ) {
		this.handler = handler;
	}
	
	public setDown() {
		this.handler = undefined;
	}
}

export default class RouterCLI {
	protected router:Router = new Router();
	protected socks:DgramSocket[] = [];
	
	public static parseOptions(argv:string[]):RouterCLIOptions {
		let currCommand:string[]|null = null;
		let commands:string[][] = [];
		function flushCommand() {
			if( currCommand != null ) {
				commands.push(currCommand);
				currCommand = null;
			}
		}
		for( let i = 2; i < argv.length; ++i ) {
			const arg = argv[i];
			if( arg[0] == '+' ) {
				flushCommand();
				currCommand = [arg.substr(1)];
			} else if( currCommand != null ) {
				currCommand.push(arg);
			} else {
				throw new Error("Unrecognized argument: "+arg);
			}
		}
		flushCommand();
		return {
			commands: commands,
		}
	}
	
	protected httpServer? : HTTPServer;
	protected expressApp? : ExpressApp;
	protected webSocketServer? : WebSocketServer;
	protected getOrCreateWebServer():HTTPServer {
		if( this.httpServer ) return this.httpServer;
		
		this.httpServer = createHttpServer();
		this.expressApp = createExpressApp(); //require('express')();
		this.expressApp.use( (req:ExpressRequest, res:ExpressResponse) => {
			res.send("Hi.  Maybe ye want to Upgrade: websocket?\n");
		});
		this.httpServer.on('request', this.expressApp);
		this.webSocketServer = new WebSocketServer({ server: this.httpServer });
		function getRequestClientAddress(req:ExpressRequest) {
			return req.ip || req.connection.remoteAddress;
		}
		this.webSocketServer.on('connection', (ws:WebSocket) => {
			console.log("Received WebSocket connection from "+getRequestClientAddress(ws.upgradeReq));
			
			const location = parseUrl(ws.upgradeReq.url, true);
			const linkId = this.router.newLinkId();
			const link = new WebSocketLink(ws);			
		});
		return this.httpServer;
	}
	
	protected openTunWebSocketServerPort( port:number ) {
		const httpServer = this.getOrCreateWebServer();
		httpServer.listen(port, () => console.log("Listening for HTTP requests on port "+port));
	}
	
	protected openTunUdpPort( port:number, address?:string ):LinkID {
		// Conceivably we could have more than one tunnel per UDP socket
		// and forwarding to different handlers based on remote address/port.
		
		const sock = createDgramSocket('udp4');
		sock.on('error', (err:any) => {
			console.error("Error opening datagram server on port "+port, err);
		});
		sock.bind( port, address );
		this.socks.push(sock);
		
		const linkId = this.router.newLinkId('udp');
		const link = new UDPTunnelLink(sock);
		this.router.addLink( link, linkId );
		
		return linkId;
	}
	
	public doCommand( command:string[] ):void {
		if( command.length == 0 ) {
			throw new Error("Invalid (because zero-length) command given");
		}
		switch( command[0] ) {
		case 'set-router-address':
			{
				const addrString = command[1];
				if( addrString == null ) throw new Error("Must provide an address to "+command[0]);
				const addr = parseIp6Address(addrString);
				this.router.routerAddress = addr;
			}
			break;
		case 'enable-ping-response':
			this.router.shouldRespondToPings = true;
			break;
		case 'enable-unreachablity-notifications':
			this.router.shouldSendUnreachabilityMessages = true;
			break;
		case 'listen-tun-wss':
			{
				const portStr = command[1];
				if( portStr == null ) {
					throw new Error("Must include port after "+command[0]);
				}
				const port = parseInt(portStr);
				this.openTunWebSocketServerPort(port);
			}; break;
		case 'listen-tun-udp':
			{
				const portStr = command[1];
				if( portStr == null ) {
					throw new Error("Must include port after "+command[0]);
				}
				const port = parseInt(portStr);
				const routeStr = command[2];
				const linkId = this.openTunUdpPort(port);
				if( routeStr ) {
					const rp = routeStr.split('/', 2);
					const routeAddress = parseIp6Address(rp[0]);
					const routePrefixLength = parseInt(rp[1]);
					this.router.addRoute( routeAddress, routePrefixLength, linkId );
				}
			}; break;
		default:
			throw new Error("Invalid command: "+command[0]);
		}
	}
	
	public stop():void {
		for( let s in this.socks ) this.socks[s].close();
	}
	
	public start():void {
		console.log("Router CLI started");
	}
	
	public static createAndStart(options:RouterCLIOptions):RouterCLI {
		const rcli = new RouterCLI();
		for( let c in options.commands ) {
			rcli.doCommand(options.commands[c]);
		}
		rcli.start();
		return rcli;
	}
}

export interface RouterCLIOptions {
	commands:string[][];
}

if( require.main === module ) {
	RouterCLI.createAndStart( RouterCLI.parseOptions(process.argv) );
}
