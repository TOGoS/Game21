import IP6Address from './IP6Address';
import { InternetChecksumming } from '../../tshash/InternetChecksum';

export const PROTOCOL_NUMBER = 58;

export interface ICMP6Message {
	type : number
	code : number
	checksum? : number
	payload : Uint8Array
}

// Temporary buffers used for calculating checksums
const checksumming = new InternetChecksumming();
const tempDv = new DataView(new ArrayBuffer(4));
const tempU8a = new Uint8Array(tempDv.buffer);

function uint32ToU8a( n:number ):Uint8Array {
	tempDv.setUint32(0, n);
	return tempU8a;
}

// ICMPv6 checksum = internetChecksum(
//   sourceAddress ++                                                     \
//   destAddress ++                                                        |
//   icmp6 packet length (32 bits) ++                                      \ Pseudo-IP-packet
//   next header (32 bits, top 24 being zeroes) ++                         /
//   type (8 bits) ++ code (8 bits) ++ zero (16 bits) ++    \ ICMP packet  |
//   icmp6 payload                                          /             /
// )

export function calculateIcmp6Checksum( sourceAddress:IP6Address, destAddress:IP6Address, icmpMessage:ICMP6Message ):number {
	checksumming.reset();
	checksumming.update(sourceAddress);
	checksumming.update(destAddress);
	checksumming.update(uint32ToU8a(icmpMessage.payload.length + 4));
	checksumming.update(uint32ToU8a(PROTOCOL_NUMBER));
	checksumming.update(uint32ToU8a((icmpMessage.type << 24) | (icmpMessage.code << 16) | 0));
	checksumming.update(icmpMessage.payload);
	return checksumming.digestAsUint16();
}

export function assembleIcmp6Packet( icmpMessage:ICMP6Message, sourceAddress:IP6Address, destAddress:IP6Address ):Uint8Array {
	if( icmpMessage.checksum == null ) {
		icmpMessage.checksum = calculateIcmp6Checksum( sourceAddress, destAddress, icmpMessage );
	}
	const packet = new Uint8Array(4 + icmpMessage.payload.length);
	packet[0] = icmpMessage.type;
	packet[1] = icmpMessage.code;
	packet[2] = icmpMessage.checksum >> 8;
	packet[3] = icmpMessage.checksum >> 0;
	packet.set(icmpMessage.payload, 4);
	return packet;
}

export function disassembleIcmp6Packet( packet:Uint8Array ):ICMP6Message {
	return {
		type : packet[0],
		code : packet[1],
		checksum : (packet[2]<<8) | packet[3],
		payload : new Uint8Array(packet.buffer, packet.byteOffset+4, packet.byteLength-4),
	}
}
