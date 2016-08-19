import { verifyIp6PacketChecksum } from './checksumming';

export const UDP_PROTOCOL_NUMBER = 17;

export interface UDPMessage {
	sourcePort : number;
	destPort : number;
	length : number;
	checksum : number;
	payload : Uint8Array;
}

/**
 * @param packet the 'UDP message' part of the IP packet; i.e. the payload of a type-17 IP packet
 */
export function disassembleUdpPacket( packet:Uint8Array ):UDPMessage {
	const dv = new DataView( packet.buffer, packet.byteOffset, packet.byteLength );
	const indicatedLength = dv.getUint16(4);
	const clampedLength = Math.min( packet.length, indicatedLength );
	return {
		sourcePort: dv.getUint16(0),
		destPort: dv.getUint16(2),
		length: clampedLength,
		checksum: dv.getUint16(6),
		payload: new Uint8Array(packet.buffer, packet.byteOffset + 8, clampedLength - 8),
	};
}

export function verifyUdp6PacketChecksum( sourceAddress:Uint8Array, destAddress:Uint8Array, ipPayload:Uint8Array ):boolean {
	return verifyIp6PacketChecksum( sourceAddress, destAddress, UDP_PROTOCOL_NUMBER, ipPayload );
}
