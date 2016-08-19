import { InternetChecksumming } from '../../tshash/InternetChecksum';

type IP6Address = Uint8Array;
type IPPayload = Uint8Array;

// Temporary buffers used for calculating checksums
export const checksumming = new InternetChecksumming();
export const tempDv = new DataView(new ArrayBuffer(4));
export const tempU8a = new Uint8Array(tempDv.buffer);

export default checksumming;

export function uint32ToU8a( n:number ):Uint8Array {
	tempDv.setUint32(0, n);
	return tempU8a;
}

export function initIp6PseudoHeaderChecksumming( sourceAddress:IP6Address, destAddress:IP6Address, innerPacketLength:number, protocolNumber:number) {
	checksumming.reset();
	checksumming.update(sourceAddress);
	checksumming.update(destAddress);
	checksumming.update(uint32ToU8a(innerPacketLength));
	checksumming.update(uint32ToU8a(protocolNumber));
}

/**
 * IP6 packets do not have a checksum!
 * But some protocols do that calculate their checksums in a standard way.
 * This does that.
 */
export function calculateIp6PacketChecksum( sourceAddress:IP6Address, destAddress:IP6Address, protocolNumber:number, ipPayload:IPPayload ) {
	initIp6PseudoHeaderChecksumming( sourceAddress, destAddress, ipPayload.length, protocolNumber );
	checksumming.update(ipPayload);
	return checksumming.digestAsUint16();
}

/**
 * Assuming that ipPayload contains the checksum on some 16-bit boundary
 * calculated using calculateInternetChecksum.
 * Calculating it again should return a checksum of zero.
 */
export function verifyIp6PacketChecksum( sourceAddress:IP6Address, destAddress:IP6Address, protocolNumber:number, ipPayload:IPPayload ) {
	return calculateIp6PacketChecksum( sourceAddress, destAddress, protocolNumber, ipPayload ) == 0;
}
