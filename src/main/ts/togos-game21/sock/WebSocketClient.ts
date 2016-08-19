/// <reference path="../../ws.d.ts"/>

import IP6Address, {
	parseIp6Address,
	stringifyIp6Address,
	UNSPECIFIED_ADDRESS,
	ALL_NODES_ADDRESS
} from '../inet/IP6Address';
import { IPMessage, assembleIpPacket, disassembleIpPacket } from '../inet/ip';
import {
	ICMP_PROTOCOL_NUMBER,
	ICMP_TYPE_PING,
	ICMP_TYPE_PONG,
	ICMP_TYPE_ROUTER_ADVERTISEMENT,
	ICMPMessage,
	verifyIcmp6PacketChecksum,
	assembleIcmp6Packet,
	disassembleIcmp6Packet
} from '../inet/icmp6';
import {
	LinkID
} from '../inet/Router';
import { compareByteArrays } from '../util';
import { hexDecode } from '../../tshash/utils';
import Logger from '../Logger';

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

function randomLinkLocalAddress():IP6Address {
	const arr = new Uint8Array(16);
	arr[0] = 0xfe;
	arr[1] = 0x80;
	for( let i=8; i<16; ++i ) {
		arr[i] = Math.random()*256;
	}
	return arr;
}

export default class WebSocketClient {
	public connection:WebSocket|undefined;
	public enqueuedMessages:Uint8Array[];
	public myLinkAddress:IP6Address;
	public myGlobalAddress:IP6Address;
	public nextPingSequenceNumber:number=0;
	public logger:Logger;
	
	constructor() {
		this.connection = undefined;
		this.enqueuedMessages = [];
		// placeholders!
		this.myLinkAddress = randomLinkLocalAddress();
		this.myGlobalAddress = UNSPECIFIED_ADDRESS;
		this.logger = window.console;
	}
	public connectIfNotConnected(wsUrl:string):WebSocketClient {
		if( this.connection == null ) {
			this.logger.log("Attempting to connect to "+wsUrl);
			this.connection = new WebSocket(wsUrl);
			this.connection.binaryType = 'arraybuffer';
			this.connection.onopen = this.onOpen.bind(this);
			this.connection.onerror = (error) => {
				this.connection = undefined;
				this.logger.log("Websocket Error:", error, "; disconnected");
			};
			this.connection.onmessage = this.onMessage.bind(this);
			this.logger.log("Connecting...");
		}
		return this;
	}
	protected onOpen() {
		this.logger.log('Connected!');
		if( !this.connection ) throw new Error("But somehow connection not set in onOpen!");
		for( var i=0; i < this.enqueuedMessages.length; ++i ) {
			this.connection.send(this.enqueuedMessages[i]);
		}
		this.logger.log("Sent "+this.enqueuedMessages.length+" queued messages.");
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
			this.logger.error("Received non-ArrayBuffer from socket");
		}
		const packet = new Uint8Array(data);
		this.receivePacket(packet);
	};
	
	protected shouldRespondToPings = true;
	
	// TODO: Embed some kind of Host or Router object and have it deal with this stuff
	
	protected handleOwnPing( icmpMessage:ICMPMessage, ipMessage:IPMessage, sourceLinkId?:LinkID ):void {
		if( !this.shouldRespondToPings ) return;
		
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
	
	protected handleOwnRouterAdvertisement( icmpMessage:ICMPMessage, ipMessage:IPMessage, sourceLinkId?:LinkID ):void {
		// TODO
		this.logger.log("Received a router advertisement!");
	}
	
	protected handleOwnIcmpMessage( icmpMessage:ICMPMessage, ipMessage:IPMessage, sourceLinkId?:LinkID ):void {
		if( !verifyIcmp6PacketChecksum(ipMessage.sourceAddress, ipMessage.destAddress, ipMessage.payload ) ) {
			this.logger.warn("Bad ICMP checksum; dropping packet.");
			return;
		}
		
		this.logger.log("ICMP message type: "+icmpMessage.type);
		
		switch( icmpMessage.type ) {
		case ICMP_TYPE_PING:
			this.handleOwnPing(icmpMessage, ipMessage, sourceLinkId);
			break;
		case ICMP_TYPE_ROUTER_ADVERTISEMENT:
			this.handleOwnRouterAdvertisement(icmpMessage, ipMessage, sourceLinkId);
			break;
		default:
			this.logger.log("Unrecognized ICMP message type: "+icmpMessage.type);
		}
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
			this.logger.error(e);
			return;
		}
		this.logger.log(
			"Received packet from "+
				stringifyIp6Address(ipMessage.sourceAddress)+" to "+
				stringifyIp6Address(ipMessage.destAddress)+", protocol number "+
				ipMessage.protocolNumber);
		if(
			compareByteArrays(ipMessage.destAddress, this.myGlobalAddress) == 0 ||
			compareByteArrays(ipMessage.destAddress, ALL_NODES_ADDRESS) == 0
		) {
			this.logger.log("This packet is for me!");
			this.handleOwnIpMessage(ipMessage);
		}
	}
	
	protected enqueuePacket(data:Uint8Array):void {
		this.checkConnection();
		if( this.connection != null && this.connection.readyState == 1 ) {
			this.logger.log("Sending message now");
			this.connection.send(data);
		} else {
			this.logger.log("Not yet connected; enqueing message.");
			this.enqueuedMessages.push(data);
		}
	};
	
	protected ping(peerAddress:IP6Address) {
		this.enqueuePacket( assembleIpPacket({
			ipVersion: 6,
			sourceAddress: this.myGlobalAddress,
			destAddress: peerAddress,
			hopLimit: 64,
			protocolNumber: ICMP_PROTOCOL_NUMBER,
			payload: assembleIcmp6Packet({
				type: ICMP_TYPE_PING,
				code: 0,
				payload: hexDecode('01234567'),
			}, this.myGlobalAddress, peerAddress)
		}));
	}
}
