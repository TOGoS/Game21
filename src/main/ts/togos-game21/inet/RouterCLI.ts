/**
 * Command-line program that starts a Router
 * and allows you to manage it via command-line arguments.
 */

// Node stuff
/// <reference path="../../node.d.ts"/>
import {
	Server as HTTPServer,
	createServer as createHttpServer
} from 'http';
import WebSocketLike from '../WebSocketLike';
import WSWebSocket from '../WSWebSocket';
import Express, {Request as ExpressRequest, Response as ExpressResponse} from 'express';

import Router from './Router';

function setExitCode( c:number ):void {
	if( typeof(process) == 'object' ) process.exitCode = c;
}

export default class RouterCLI {
	protected router:Router = new Router();
	
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
	protected getOrCreateWebServer():HTTPServer {
		if( this.httpServer ) return this.httpServer;
		
		this.httpServer = createHttpServer();
		return this.httpServer;
	}
	
	protected openTunWebSocketServerPort( port:number ) {
		const httpServer = this.getOrCreateWebServer();
		// TODO: attach express app, web socket thinger, etc
		httpServer.listen(port, () => console.log("Listening for HTTP requests on port "+port));
	}
	
	protected openTunUdpPort( port:number ) {
		console.error("udp server not yet implemented!");
	}
	
	public doCommand( command:string[] ):void {
		if( command.length == 0 ) {
			throw new Error("Invalid (because zero-length) command given");
		}
		switch( command[0] ) {
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
				this.openTunUdpPort(port);
			}; break;
		default:
			throw new Error("Invalid command: "+command[0]);
		}
	}
	
	public start() {
		console.log("Router CLI started (by which I mean not going to do anything).");
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
