import { InternetChecksumming } from '../../tshash/InternetChecksum';

// Temporary buffers used for calculating checksums
export const checksumming = new InternetChecksumming();
export const tempDv = new DataView(new ArrayBuffer(4));
export const tempU8a = new Uint8Array(tempDv.buffer);

export default checksumming;

export function uint32ToU8a( n:number ):Uint8Array {
	tempDv.setUint32(0, n);
	return tempU8a;
}

export function initIp6PseudoHeaderChecksumming( sourceAddress:Uint8Array, destAddress:Uint8Array, innerPacketLength:number, protocolNumber:number) {
	checksumming.reset();
	checksumming.update(sourceAddress);
	checksumming.update(destAddress);
	checksumming.update(uint32ToU8a(innerPacketLength));
	checksumming.update(uint32ToU8a(protocolNumber));
}
