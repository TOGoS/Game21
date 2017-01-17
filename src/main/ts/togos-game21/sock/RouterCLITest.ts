// applicable-environments: node
/// <reference path="../../node.d.ts"/>

import RouterCLI from './RouterCLI';
import {
	createSocket as createDgramSocket,
	Socket as DgramSocket,
	RemoteInfo
} from 'dgram';
import {
	parseIp6Address,
	stringifyIp6Address,
} from '../inet/IP6Address';
import {
	assembleIpPacket,
	disassembleIpPacket
} from '../inet/ip';
import {
	ICMP_PROTOCOL_NUMBER,
	ICMP_TYPE_PING,
	ICMP_TYPE_PONG,
	verifyIcmp6PacketChecksum,
	assembleIcmp6Packet,
	disassembleIcmp6Packet
} from '../inet/icmp6';
import { hexEncode, hexDecode } from 'tshash/utils';
import { registerTestResult } from '../testing';
import { compareByteArrays } from '../util';

const clientAddress = parseIp6Address('fded:006a:a932:8f41::1');
const routerAddress = parseIp6Address('fded:006a:a932:8f41::2');

const routerPort = 58876;
const clientPort = 58875;

const opts = RouterCLI.parseOptions( [
	'', '',
	'+listen-tun-udp', ''+routerPort, stringifyIp6Address(clientAddress)+'/128',
	'+enable-ping-response',
	'+set-router-address', stringifyIp6Address(routerAddress),
] );
const routerCli = RouterCLI.createAndStart(opts);

const clientSock = createDgramSocket('udp4');
clientSock.on('error', (err:any) => {
	console.error(err);
	clientSock.close();
});
clientSock.bind(clientPort);

registerTestResult("ping", new Promise( (resolve,reject) => {
	function stop() {
		routerCli.stop();
		clientSock.close();
	}

	let receivedIpPackets = false;
	let receivedIcmpPackets = false;
	let receivedPongPackets = false;
	
	function timedOut() {
		stop();
		let msg = "Never got our pong";
		     if( receivedPongPackets ) msg += " (but did receive some pong packets)";
		else if( receivedIcmpPackets ) msg += " (but did receive some ICMP packets)";
		else if( receivedIpPackets   ) msg += " (but did receive some IP packets)";
		msg += ".";
		reject(new Error(msg));
	}
	
	const timeoutTimeout = setTimeout( timedOut, 1000 );
	
	const pingPayload = hexDecode('012345');
	
	const pingMessage = {
		type: ICMP_TYPE_PING,
		code: 0,
		payload: pingPayload,
	};
	const pingPacket = assembleIcmp6Packet( pingMessage, clientAddress, routerAddress );
	
	if( !verifyIcmp6PacketChecksum( clientAddress, routerAddress, pingPacket ) ) {
		throw new Error("I messed up making this ping packet; its checksum doesn't seem right.");
	}
	
	const pingIpPacket = assembleIpPacket( {
		ipVersion: 6,
		sourceAddress: clientAddress,
		destAddress: routerAddress,
		hopLimit: 64,
		protocolNumber: ICMP_PROTOCOL_NUMBER,
		payload: pingPacket
	} );
	
	clientSock.send( new Buffer(pingIpPacket), 0, pingIpPacket.length, routerPort, '127.0.0.1' );
	clientSock.on('message', (packet:Buffer, rinfo:RemoteInfo) => {
		const ipMessage = disassembleIpPacket(packet);
		receivedIpPackets = true;
		if( ipMessage.protocolNumber == ICMP_PROTOCOL_NUMBER ) {
			const icmpMessage = disassembleIcmp6Packet(ipMessage.payload);
			receivedIcmpPackets = true;
			if( icmpMessage.type == ICMP_TYPE_PONG ) {
				receivedPongPackets = true;
				if( compareByteArrays(icmpMessage.payload, pingPayload) == 0 ) {
					// That's our pong!
					stop();
					clearTimeout(timeoutTimeout);
					resolve({});
				}
			}
		}
	});
}));
