// Make sure we can do IP6 packets and ICMP responses

/// <reference path="../../node.d.ts"/>

import { hexEncode } from '../../tshash/utils';
import {
	IPMessage, IP6Message, disassembleIpPacket, assembleIpPacket
} from './ip';
import {
	ICMPMessage,
	assembleIcmp6Packet,
	disassembleIcmp6Packet,
	calculateIcmp6Checksum,
	ICMP_PROTOCOL_NUMBER,
	ICMP_TYPE_PING,
	ICMP_TYPE_PONG
} from './icmp6';
import {
	UDPMessage,
	calculateUdp6Checksum,
	disassembleUdpPacket
} from './udp';
import {
	stringifyIp6Address
} from './IP6Address';
import { Socket as DgramSocket } from 'dgram';

class UDPTunnel {
	constructor( protected onPacket:(packet:Uint8Array)=>void ) {}
	
	protected socket:DgramSocket;
	protected peerAddress:string;
	protected peerPort:number;
	
	public send( packet:Uint8Array ) {
		const buf = new Buffer(packet);
		console.log("Sending buffer ("+buf.length+" bytes) to "+this.peerAddress+":"+this.peerPort);
		this.socket.send( buf, 0, packet.length, this.peerPort, this.peerAddress );
	}
	
	public listen(port:number):void {
		const dgram = require('dgram');
		this.socket = dgram.createSocket('udp4');
		
		this.socket.on('listening', () => {
			console.log("Listening on "+port);
		});
		this.socket.on('message', (msg:any,rinfo:any) => {
			//console.log("Received message from "+rinfo.address+":"+rinfo.port+"; length="+msg.length);
			this.peerAddress = rinfo.address;
			this.peerPort = rinfo.port;
			this.onPacket( <Uint8Array>msg );
		});
		this.socket.on('error', (e:any) => { console.error("Error from UDP tunnel", e); });
		
		this.socket.bind(port);
	}
}

let tun = new UDPTunnel( (packet:Uint8Array) => {} ); // Fake out TypeScript compiler
tun = new UDPTunnel( (packet:Uint8Array) => {
	try {
		const ipMessage = <IP6Message>disassembleIpPacket(packet);
		console.log(
			"Received packet of length "+packet.length+" from "+
			stringifyIp6Address(ipMessage.sourceAddress)+" to "+
			stringifyIp6Address(ipMessage.destAddress)+"; protocol "+
			ipMessage.protocolNumber
		);
		if( ipMessage.protocolNumber == 17 ) {
			console.log("UDP!");
			const udpMessage = disassembleUdpPacket( ipMessage.payload );
			const calcChecksum = calculateUdp6Checksum( ipMessage.sourceAddress, ipMessage.destAddress, udpMessage );
			console.log("Included checksum: "+udpMessage.checksum+", calculated: "+calcChecksum);
		} else if( ipMessage.protocolNumber == ICMP_PROTOCOL_NUMBER ) {
			const icmp6Message = disassembleIcmp6Packet( ipMessage.payload );
			console.log("Received ICMP6 message; type="+icmp6Message.type+", code="+icmp6Message.code);
			const calculatedChecksum = calculateIcmp6Checksum(ipMessage.sourceAddress, ipMessage.destAddress, icmp6Message);
			if( icmp6Message.checksum != calculatedChecksum ) {
				console.log("Received ICMP6 packet with invalid checksum; dropping.");
				return;
			}
			if( icmp6Message.type == ICMP_TYPE_PING ) {
				// It's a ping!  Let's respond to it.
				const responseMessage:ICMPMessage = {
					type: ICMP_TYPE_PONG,
					code: 0,
					payload: icmp6Message.payload
				};
				const responseIcmpPacket:Uint8Array = assembleIcmp6Packet( responseMessage, ipMessage.destAddress, ipMessage.sourceAddress );
				
				const calcResponseChecksum = calculateIcmp6Checksum( ipMessage.destAddress, ipMessage.sourceAddress, responseMessage );
				const storedResponseChecksum = new DataView(responseIcmpPacket.buffer, responseIcmpPacket.byteOffset, responseIcmpPacket.byteLength).getUint16(2);
				if( calcResponseChecksum != storedResponseChecksum ) {
					console.log("Chxas", calcResponseChecksum, storedResponseChecksum );
				}
				
				const responseIpPacket = assembleIpPacket( <IP6Message>{
					ipVersion: 6,
					trafficClass: ipMessage.trafficClass,
					flowLabel: ipMessage.flowLabel,
					protocolNumber: 58,
					hopLimit: 64,
					sourceAddress: ipMessage.destAddress,
					destAddress: ipMessage.sourceAddress,
					payload: responseIcmpPacket,
				} );
				
				// Ack need to send an ip packet
				tun.send( responseIpPacket );
			}
		}
		//console.log(  );
	} catch( e ) {
		console.error(e);
		return;
	}
});

tun.listen(10150);
