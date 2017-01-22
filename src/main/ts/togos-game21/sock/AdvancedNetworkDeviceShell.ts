/// <reference path="../../Promise.d.ts"/>
import KeyedList from '../KeyedList';
import MessageLink from './MessageLink';
import Repeater, { RepeaterSimulator } from '../netdev/Repeater';
import NetworkDeviceShell from '../netdev/NetworkDeviceShell';
import Logger, { NULL_LOGGER } from '../Logger';

//// Link pair/codec crap

interface MessageCodec<A,B> {
	encode( a:A ):Thenable<B>;
	decode( b:B ):Thenable<A>;
}

const NOOP_CODEC = {
	encode: <T>(x:T):T => x,
	decode: <T>(x:T):T => x,
}

interface LinkPair<MessageA,MessageB> {
	linkA: MessageLink<MessageA>;
	linkB: MessageLink<MessageB>;
}

function combineCodec<A,B,C>( codec0:MessageCodec<A,B>, codec1:MessageCodec<B,C> ):MessageCodec<A,C> {
	if( codec0 === NOOP_CODEC ) return codec1 as any as MessageCodec<A,C>;
	return {
		encode: (a:A):Thenable<C> => codec0.encode(a).then( (b) => codec1.encode(b) ),
		decode: (c:C):Thenable<A> => codec1.decode(c).then( (b) => codec0.decode(b) ),
	};
}

class PairedLink<A,B> implements MessageLink<A> {
	protected _state:"up"|"down" = "down";
	public constructor( protected encoder:(a:A)=>Thenable<B> ) {}
	packetListener?: (packet:A)=>void;
	counterpart?: PairedLink<B,A>;
	setUp(listener:(packet:A)=>void) {
		this._state = "up";
		this.packetListener = listener;
	}
	send(packet:A) {
		if( this._state !== "up" ) return;
		this.encoder(packet).then(
			(b) => {
				const counterpart = this.counterpart;
				if( !counterpart ) return;
				if( counterpart.state !== "up" ) return;
				if( !counterpart.packetListener ) return;
				counterpart.packetListener(b);
			},
			(err) => console.error("Message filter had a error ;(", err)
		);
	}
	setDown() {
		this._state = "down";
	}
	public get state() { return this._state; }
}


function createLinkPair<A,B>( codec:MessageCodec<A,B> ):LinkPair<A,B> {
	const linkA:PairedLink<A,B> = new PairedLink(codec.encode);
	const linkB:PairedLink<B,A> = new PairedLink(codec.decode);
	linkA.counterpart = linkB;
	linkB.counterpart = linkA;
	return { linkA, linkB };
}

/*
 * Link strings
 * General form: <device>|<codec>|<codec>|<device>
 * Message encoding goes from left to right.
 * Device on the left may actually be a device generator
 * which may duplicate the chain on its right (but to the same right endpoint).
 * 
 * Devices and codec strings are of the form:
 * [<devName>=]<classname>[:<optionstring>]
 * 
 * If <devName> is given, the device can be referenced again later
 * and more links added to it.  It does not make sense to re-use link generators this way.
 * 
 * <optionstring> is any string consisting of alphanumeric characters, "=@:_-+"
 * Its interpretation depends on the device class.
 */

interface LinkGenerator<Message> {
	start( linkFactory: () => MessageLink<Message> ):void;
	stop():void;
}

import {
	createSocket as createDgramSocket,
	Socket as DgramSocket,
	RemoteInfo
} from 'dgram';

class UDPLinkServer implements LinkGenerator<Uint8Array> {
	protected linkFactory? : () => MessageLink<Uint8Array>;
	protected linksByAddressAndPort:{[hostAddr:string]: MessageLink<Uint8Array>[]} = {};
	public logger:Logger = NULL_LOGGER;
	
	public constructor( protected sock : DgramSocket ) { }
	
	public start( linkFactory: () => MessageLink<Uint8Array> ) {
		this.linkFactory = linkFactory;
		
		this.sock.on('message', (msg:Buffer, rinfo:RemoteInfo) => {
			// TODO: only if set to dynamically
			// accept connections
			const link = this.getLink(rinfo.address, rinfo.port);
			if( link ) link.send(msg);
		});
	}
	
	stop() {
		this.sock.close();
	}
	
	protected getLink( addr:string, port:number ):MessageLink<Uint8Array>|undefined {
		let forThisAddress = this.linksByAddressAndPort[addr]
		if( forThisAddress == undefined ) {
			forThisAddress = this.linksByAddressAndPort[addr] = [];
		}
		
		const link = forThisAddress[port];
		if( link == undefined ) {
			// Create new link!
			if( !this.linkFactory ) {
				console.error("No linkFactory; can't create link!");
				return undefined;
			};
			const link = this.linkFactory();
			this.logger.log("New UDP link from "+addr+":"+port);
			link.setUp( (p:Uint8Array) => {
				this.sock.send(<Buffer>p, p.byteOffset, p.byteLength, port, addr, (err,bytes) => {
					if( err ) console.error("Error sending some bytes to "+addr+":"+port, err);
				});
			});
			this.linksByAddressAndPort[addr][port] = link;
		}
		
		return link;
	}
}

interface LinkGeneratorChainTerminal<M> {
	className: "LinkGeneratorChainTerminal";
	alias?: string;
	linkGenerator: LinkGenerator<M>;
}
interface DeviceChainTerminal<D,M> {
	className: "DeviceChainTerminal";
	alias?: string;
	device: NetworkDeviceShell<D,M>;
}
type ChainTerminal<D,M> =
	LinkGeneratorChainTerminal<M> |
	DeviceChainTerminal<D,M>;

function loggingCodec<X>(aToBMessage:string, bToAMessage:string) : MessageCodec<X,X> {
	return {
		encode( a:X ) {
			console.log(aToBMessage);
			return Promise.resolve(a);
		},
		decode( b:X ) {
			console.log(bToAMessage);
			return Promise.resolve(b);
		}
	};
}

export default class AdvancedNetworkDeviceShell<Device,Message> {
	protected namedDevices:KeyedList<NetworkDeviceShell<any,Uint8Array>> = {};
	public logger:Logger = NULL_LOGGER;
	
	public chainTerminalFromString( devStr:string ):ChainTerminal<any,Uint8Array> {
		const params = devStr.split(":");
		const ax = params[0].split('=');
		const devClassName = ax[ax.length-1];
		const alias:string|undefined = ax.length > 1 ? ax[0] : undefined;
		let terminal:ChainTerminal<any,Uint8Array>;
		if( alias == undefined && this.namedDevices[devClassName] ) {
			return {
				className: "DeviceChainTerminal",
				alias: alias,
				device: this.namedDevices[devClassName]
			};
		} else if( devClassName == "udp-server") {
			if( params.length == 1 ) throw new Error("Port number required for UDP link server");
			let addr:string, port:number;
			if( params.length == 2 ) {
				addr = "";
				port = parseInt(params[1]);
			} else if( params.length == 3 ) {
				addr = params[1];
				port = parseInt(params[2]);
			} else {
				throw new Error("Too many params to UDP link server: "+devStr);
			}
			
			terminal = {
				className: "LinkGeneratorChainTerminal",
				alias,
				linkGenerator: (() => {
					const sock = createDgramSocket('udp4'); // TODO: Not necessarily v4
					sock.bind(port, addr);
					this.logger.log("Listeningfor UDP packets on "+addr+":"+port);
			
					const udpLinkServer = new UDPLinkServer(sock);
					udpLinkServer.logger = this.logger;
					return udpLinkServer;
				})()
			};
		} else if( devClassName == "repeater" ) {
			terminal = {
				className: "DeviceChainTerminal",
				alias,
				device: new NetworkDeviceShell(new RepeaterSimulator())
			};
		} else {
			throw new Error("Unrecognized device or device generator string: '"+devClassName+"'");
		}
		if( alias && terminal.className == "DeviceChainTerminal" ) {
			this.namedDevices[alias] = terminal.device;
		}
		return terminal;
	}
	
	public codecFromString<A,B>( codecStr:string ):MessageCodec<A,B> {
		const params = codecStr.split(":");
		if( params[0] == 'log' ) {
			return loggingCodec(params[1] || ">", params[2] || "<");
		}
		throw new Error("Unrecognized message codec class: "+params[0])
	}
	
	public addLinkFromString( linkStr:string ):void {
		const comps = linkStr.split('|');
		if( comps.length < 2 ) throw new Error("Link string must have at least 2 components to indicate endpoints");
		const end0 = this.chainTerminalFromString(comps[0]);
		let codec = NOOP_CODEC;
		for( let i=1; i<comps.length-1; ++i ) {
			codec = combineCodec(codec, this.codecFromString(comps[i]));
		}
		const end1 = this.chainTerminalFromString(comps[comps.length-1]);
		if( end1.className == "LinkGeneratorChainTerminal" ) {
			throw new Error("Left endpoint can't be a link generator!");
		}
		switch( end0.className ) {
		case "LinkGeneratorChainTerminal":
			end0.linkGenerator.start( () => {
				const linkPair = createLinkPair(codec);
				end1.device.addLink(linkPair.linkB);
				return linkPair.linkA;
			});
			break;
		default:
			{
				const linkPair = createLinkPair(codec);
				end0.device.addLink(linkPair.linkA);
				end1.device.addLink(linkPair.linkB);
			}
		}
	}
	
	public start() { }
}

if( typeof module != 'undefined' && typeof require != 'undefined' && require.main == module ) {
	const ands = new AdvancedNetworkDeviceShell();
	ands.logger = console;
	for( let i=2; i<process.argv.length; ++i ) {
		ands.addLinkFromString(process.argv[i]);
	}
	ands.start();
}
