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
	calculateIcmp6Checksum,
	assembleIcmp6Packet,
	disassembleIcmp6Packet
} from '../inet/icmp6';
import { hexEncode, hexDecode } from '../../tshash/utils';
import { registerTestResult } from '../testing';

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
	function timedOut() {
		stop();
		reject(new Error("Never got our pong. :("));
	}
	
	const timeoutTimeout = setTimeout( timedOut, 1000 );
	
	const pingMessage = {
		type: ICMP_TYPE_PING,
		code: 0,
		payload: hexDecode('012345'),
	};
	const pingPacket = assembleIcmp6Packet( pingMessage, clientAddress, routerAddress );
	
	{
		const calcChecksum = calculateIcmp6Checksum( clientAddress, routerAddress, pingMessage );
		const _pingMessage = disassembleIcmp6Packet(pingPacket);
		if( _pingMessage.checksum != calcChecksum ) {
			console.log(pingMessage, _pingMessage);
			throw new Error("I messed up making this ping packet; "+_pingMessage.checksum+" != "+calcChecksum);
		}
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
	clientSock.on('message', (msg:Buffer, rinfo:RemoteInfo) => {
		console.log("Got something in response!!");
		// TODO: check message
		stop();
		clearTimeout(timeoutTimeout);
		resolve({});
	});
}));
