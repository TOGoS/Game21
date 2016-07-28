import checksumming, { tempDv, tempU8a, uint32ToU8a, initIp6PseudoHeaderChecksumming } from './checksumming';

export const PROTOCOL_NUMBER = 17;

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

export function calculateUdp6Checksum( sourceAddress:Uint8Array, destAddress:Uint8Array, udpMessage:UDPMessage ):number {
	initIp6PseudoHeaderChecksumming( sourceAddress, destAddress, udpMessage.payload.length + 8, PROTOCOL_NUMBER );
	checksumming.update(uint32ToU8a((udpMessage.sourcePort << 16) | (udpMessage.destPort)));
	checksumming.update(uint32ToU8a((udpMessage.length << 16) | 0));
	checksumming.update(udpMessage.payload);
 	return checksumming.digestAsUint16();
}
