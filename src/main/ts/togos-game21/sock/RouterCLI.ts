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
import { ReadLine } from 'readline';

import { utf8Encode } from 'tshash/utils';
import Router, { LinkID, Link, PacketHandler } from '../inet/Router';
import {
	parseIp6Address,
	stringifyIp6Address
} from '../inet/IP6Address';
import {
	resolvedPromise
} from '../promises';
import Logger, {
	VERBOSITY_SILENT,
	VERBOSITY_ERRORS,
	VERBOSITY_WARNINGS,
	VERBOSITY_INFO,
	VERBOSITY_DEBUG,
	LevelFilteringLogger
} from '../Logger';

function setExitCode( c:number ):void {
	if( typeof(process) == 'object' ) process.exitCode = c;
}

class WebSocketLink implements Link {
	protected handler? : PacketHandler;
	
	constructor(protected conn:WebSocketLike, protected _logger:Logger) {
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
				this._logger.error("Received weird data from websocket.");
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
		try {
			if( packet.byteOffset != 0 || packet.byteLength != packet.buffer.byteLength ) {
				throw new Error("Arr; packet's array does not match 1-1 it's backing buffer")
			}
			this.conn.send( packet.buffer );
		} catch( e ) {
			this._logger.log("Failed to send packet");
			// TODO: refactor so that links can disconnect themselves.
		}
	}
	
	public setUp( handler : PacketHandler ) {
		this.handler = handler;
	}
	
	public setDown() {
		this.handler = undefined;
		this.conn.close();
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
		this.sock.close();
	}
}

const NORMAL_COMMAND_RESULT_PROMISE = resolvedPromise(undefined);

export default class RouterCLI {
	protected router:Router = new Router();
	protected socks:DgramSocket[] = [];
	public _logger:Logger = console;
	
	public static parseOptions(argv:string[]):RouterCLIOptions {
		let currCommand:string[]|null = null;
		let commands:string[][] = [];
		let interactive:boolean = false;
		let verbosity:number = VERBOSITY_WARNINGS;
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
			} else if( arg == '-i' ) {
				interactive = true;
			} else if( arg == '-s' ) {
				verbosity = VERBOSITY_SILENT;
			} else if( arg == '-q' ) {
				verbosity = VERBOSITY_ERRORS;
			} else if( arg == '-v' ) {
				verbosity = VERBOSITY_INFO;
			} else if( arg == '-debug' ) {
				verbosity = VERBOSITY_DEBUG;
			} else {
				throw new Error("Unrecognized argument: "+arg);
			}
		}
		flushCommand();
		return {
			verbosity: verbosity,
			interactive: interactive,
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
			this._logger.log("Received WebSocket connection from "+getRequestClientAddress(ws.upgradeReq));
			
			const location = parseUrl(ws.upgradeReq.url, true);
			const linkId = this.router.newLinkId('ws');
			const link = new WebSocketLink(ws, this.logger);
			this.router.addLink( link, linkId, { sendRouterAdvertisements:true } ); // TODO: configure
			// No routes automatically added!
		});
		return this.httpServer;
	}
	
	public set logger(logger:Logger) {
		this.router.logger = logger;
		this._logger = logger;
	}
	public set verbosity(v:number) {
		this.router.verbosity = v;
	}
	
	protected openTunWebSocketServerPort( port:number ) {
		const httpServer = this.getOrCreateWebServer();
		httpServer.listen(port, () => this._logger.log("Listening for HTTP requests on port "+port));
	}
	
	protected openTunUdpPort( port:number, address?:string ):LinkID {
		// Conceivably we could have more than one tunnel per UDP socket
		// and forwarding to different handlers based on remote address/port.
		
		const sock = createDgramSocket('udp4'); // TODO: Not necessarily v4
		sock.on('error', (err:any) => {
			this._logger.error("Error opening datagram server on port "+port, err);
		});
		sock.on('listening', () => {
			this._logger.log("Listening for UDP packets on port "+port);
		});
		sock.bind( port, address );
		this.socks.push(sock);
		
		const linkId = this.router.newLinkId('udp');
		const link = new UDPTunnelLink(sock);
		this.router.addLink( link, linkId );
		
		return linkId;
	}
	
	protected addRouteFromString( linkId:LinkID, routeStr:string ):void {
		if( routeStr == 'default' ) {
			this.router.addRoute( parseIp6Address('::'), 0, linkId );
		} else {
			const rp = routeStr.split('/', 2);
			const routeAddress = parseIp6Address(rp[0]);
			const routePrefixLength = parseInt(rp[1]);
			this.router.addRoute( routeAddress, routePrefixLength, linkId );
		}
	}
	
	protected addAutoRoutePrefixFromString( autoRouteStr:string ):void {
		const arParts = autoRouteStr.split('/', 3);
		if( arParts.length == 1 ) throw new Error("Must include trigger prefix length in auto-route string");
		const address = parseIp6Address(arParts[0]);
		const triggerPrefixLength = parseInt(arParts[1]);
		const routePrefixLength = arParts.length > 2 ? parseInt(arParts[3]) : 128;
		this.router.addAutoRoutePrefix( address, triggerPrefixLength, routePrefixLength );
	}
	
	public _doCommand( command:string[] ):Promise<any> {
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
			return NORMAL_COMMAND_RESULT_PROMISE;
		case 'enable-ping-response':
			this.router.shouldRespondToPings = true;
			return NORMAL_COMMAND_RESULT_PROMISE;
		case 'enable-unreachability-notifications':
			this.router.shouldSendUnreachabilityMessages = true;
			return NORMAL_COMMAND_RESULT_PROMISE;
		case 'listen-tun-wss':
			{
				const portStr = command[1];
				if( portStr == null ) {
					throw new Error("Must include port after "+command[0]);
				}
				const port = parseInt(portStr);
				this.openTunWebSocketServerPort(port);
			}
			return NORMAL_COMMAND_RESULT_PROMISE;
		case 'listen-tun-udp':
			{
				const portStr = command[1];
				if( portStr == null ) {
					throw new Error("Must include port after "+command[0]);
				}
				const port = parseInt(portStr);
				const linkId = this.openTunUdpPort(port);
				const routeStr = command[2];
				if( routeStr ) {
					this.addRouteFromString( linkId, routeStr );
				}
			}
			return NORMAL_COMMAND_RESULT_PROMISE;
		case 'print-routes':
			this._logger.log("# Begin route list");
			this.router.eachRoute( (prefix:Uint8Array, len:number, dest:LinkID) => {
				this._logger.log( stringifyIp6Address(prefix)+"/"+len+" via "+dest );
			});
			this._logger.log("# End route list");
			return NORMAL_COMMAND_RESULT_PROMISE;
		case 'auto-route':
			{
				const autoRouteStr = command[1];
				if( !autoRouteStr ) {
					throw new Error("Must include auto route string (<address>/<trigger prefix>[/<route prefix>]) to "+command[0]);
				}
				this.addAutoRoutePrefixFromString(autoRouteStr);
			}
			return NORMAL_COMMAND_RESULT_PROMISE;
		case 'exit':
			this.stop();
			return NORMAL_COMMAND_RESULT_PROMISE;
		default:
			throw new Error("Invalid command: "+command[0]);
		}
	}
	
	protected doCommand(command:string[]):Promise<any> {
		try {
			return this._doCommand(command);
		} catch( e ) {
			return Promise.reject( e );
		}
	}
	
	protected doCommandLine(line:string):Promise<any> {
		line = line.trim();
		if( line.length == 0 ) return NORMAL_COMMAND_RESULT_PROMISE;
		if( line[0] == '#' ) return NORMAL_COMMAND_RESULT_PROMISE;
		const cmd:string[] = line.split(/\s+/);
		return this.doCommand(cmd);
	}
	
	protected rl? : ReadLine;
	
	protected stopping = false;
	public stop():void {
		if( this.stopping ) return;
		this.stopping = true;
		this.router.shutDownAllLinks();
		if( this.rl ) this.rl.close();
	}
	
	public startInteractivePrompt() {
		this._logger.log("Router CLI started");
		const rl = require('readline').createInterface({
			input: process.stdin,
			output: process.stdout
		});
		rl.setPrompt('router> ');
		rl.prompt();
		rl.on('close', () => {
			this.stop();
			this._logger.log("Goodbye");
		});
		rl.on('line', (line:string) => {
			rl.pause();
			this.doCommandLine(line).then( (res:number) => {
				if( this.stopping ) return;
				rl.resume();
				rl.prompt();
			}, (err:any) => {
				this._logger.error(err);
				rl.resume();
				rl.prompt();
			});
		});
		this.rl = rl;
	}
	
	protected _start(commands:string[][], offset:number, options:RouterCLIOptions):Promise<void> {
		if( commands.length > offset ) {
			return this.doCommand(commands[offset]).then( () => {
				this._start(commands, offset+1, options);
			}, (err) => {
				this._logger.error(err);
				this._logger.log("Attempting to quit...");
				this.stop();
			});
		}
		if( options.interactive ) this.startInteractivePrompt();
		return NORMAL_COMMAND_RESULT_PROMISE;
	}
	
	public static createAndStart(options:RouterCLIOptions):RouterCLI {
		const rcli = new RouterCLI();
		if( !console.debug ) console.debug = console.log;
		const logger = new LevelFilteringLogger(console, options.verbosity);
		// Logger will filter on verbosity,
		// but sometimes to avoid the call to the logger
		// (which may involve expensively constructing messages)
		// we want to know the verbosity ourself, too.
		rcli.logger = logger;
		rcli.verbosity = options.verbosity;
		rcli._start(options.commands, 0, options);
		return rcli;
	}
}

export interface RouterCLIOptions {
	verbosity : number;
	interactive : boolean;
	commands : string[][];
}

if( require.main === module ) {
	RouterCLI.createAndStart( RouterCLI.parseOptions(process.argv) );
	// TODO: Set process exit code
}
