/// <reference path="../../ws.d.ts"/>

import IP6Address, { parseIp6Address, stringifyIp6Address } from '../inet/IP6Address';
import { IPMessage, assembleIpPacket, disassembleIpPacket } from '../inet/ip';
import {
	ICMP_PROTOCOL_NUMBER,
	ICMP_TYPE_PING,
	ICMP_TYPE_PONG,
	ICMPMessage,
	calculateIcmp6Checksum,
	assembleIcmp6Packet,
	disassembleIcmp6Packet
} from '../inet/icmp6';
import {
	LinkID
} from '../inet/Router';
import { compareByteArrays } from '../util';
import { hexDecode } from '../../tshash/utils';
import MiniConsole from '../ui/MiniConsole';

declare class WebSocket implements WebSocketLike {
	constructor(wsUrl:string);
	readyState : number;
	binaryType : string;
	close():void;
	send(data:string|ArrayBuffer):void;
	onopen : (event:any)=>void;
	onerror : (event:any)=>void;
	onclose : (event:any)=>void;
	onmessage : (event:any)=>void;
};

export default class WebSocketClient {
	public connection:WebSocket|undefined;
	public enqueuedMessages:Uint8Array[];
	public localAddress:IP6Address;
	public nextPingSequenceNumber:number=0;
	public console:MiniConsole;
	
	constructor() {
		this.connection = undefined;
		this.enqueuedMessages = [];
		// placeholders!
		this.localAddress = parseIp6Address("fe80::1");
		this.console = window.console;
	}
	public connectIfNotConnected(wsUrl:string):WebSocketClient {
		if( this.connection == null ) {
			this.console.log("Attempting to connect to "+wsUrl);
			this.connection = new WebSocket(wsUrl);
			this.connection.binaryType = 'arraybuffer';
			this.connection.onopen = this.onOpen.bind(this);
			this.connection.onerror = (error) => {
				this.connection = undefined;
				this.console.log("Websocket Error:", error, "; disconnected");
			};
			this.connection.onmessage = this.onMessage.bind(this);
			this.console.log("Connecting...");
		}
		return this;
	}
	protected onOpen() {
		this.console.log('Connected!');
		if( !this.connection ) throw new Error("But somehow connection not set in onOpen!");
		for( var i=0; i < this.enqueuedMessages.length; ++i ) {
			this.connection.send(this.enqueuedMessages[i]);
		}
		this.console.log("Sent "+this.enqueuedMessages.length+" queued messages.");
	};
	protected checkConnection() {
		if( this.connection && this.connection.readyState > 1 ) {
			// Connection closed!
			this.connection = undefined;
		}
	};
	protected onMessage(messageEvent:any):void {
		var encoding:string;
		var data = messageEvent.data;
		var logData:any;
		if( !(data instanceof ArrayBuffer) ) {
			this.console.error("Received non-ArrayBuffer from socket");
		}
		const packet = new Uint8Array(data);
		this.receivePacket(packet);
	};
	
	protected shouldRespondToPings = true;
	protected handleOwnIcmpMessage( icmpMessage:ICMPMessage, ipMessage:IPMessage, sourceLinkId?:LinkID ):void {
		if( !this.shouldRespondToPings ) return;
		if( icmpMessage.type != ICMP_TYPE_PING ) return;

		const calcChecksum = calculateIcmp6Checksum( ipMessage.sourceAddress, ipMessage.destAddress, icmpMessage );
		if( calcChecksum != icmpMessage.checksum ) {
			console.log("Bad ICMP checksum "+icmpMessage.checksum+" != expected "+calcChecksum);
			return;
		}
		
		const responseMessage:IPMessage = {
			ipVersion: 6,
			sourceAddress: ipMessage.destAddress,
			destAddress: ipMessage.sourceAddress,
			protocolNumber: ICMP_PROTOCOL_NUMBER,
			hopLimit: 64,
			payload: assembleIcmp6Packet({
				type: ICMP_TYPE_PONG,
				code: 0,
				payload: icmpMessage.payload,
			}, ipMessage.destAddress, ipMessage.sourceAddress)
		};
		const responsePacket = assembleIpPacket(responseMessage);
		this.enqueuePacket( responsePacket );
	}
	
	protected handleOwnIpMessage( ipMessage:IPMessage, sourceLinkId?:LinkID ):void {
		if( ipMessage.protocolNumber == ICMP_PROTOCOL_NUMBER ) {
			const icmpMessage = disassembleIcmp6Packet(ipMessage.payload);
			this.handleOwnIcmpMessage(icmpMessage, ipMessage, sourceLinkId);
		}
	}
	
	protected receivePacket(packet:Uint8Array):void {
		let ipMessage:IPMessage|undefined = undefined;
		try {
			ipMessage = disassembleIpPacket(packet);
		} catch( e ) {
			this.console.error(e);
			return;
		}
		this.console.log(
			"Received packet from "+
				stringifyIp6Address(ipMessage.sourceAddress)+" to "+
				stringifyIp6Address(ipMessage.destAddress)+", protocol number "+
				ipMessage.protocolNumber);
		if( compareByteArrays(ipMessage.destAddress, this.localAddress) == 0 ) {
			this.handleOwnIpMessage(ipMessage);
		}
	}
	
	protected enqueuePacket(data:Uint8Array):void {
		this.checkConnection();
		if( this.connection != null && this.connection.readyState == 1 ) {
			this.console.log("Sending message now");
			this.connection.send(data);
		} else {
			this.console.log("Not yet connected; enqueing message.");
			this.enqueuedMessages.push(data);
		}
	};
	
	protected ping(peerAddress:IP6Address) {
		this.enqueuePacket( assembleIpPacket({
			ipVersion: 6,
			sourceAddress: this.localAddress,
			destAddress: peerAddress,
			hopLimit: 64,
			protocolNumber: ICMP_PROTOCOL_NUMBER,
			payload: assembleIcmp6Packet({
				type: ICMP_TYPE_PING,
				code: 0,
				payload: hexDecode('01234567'),
			}, this.localAddress, peerAddress)
		}));
	}
}
