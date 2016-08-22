import IP6Address from './IP6Address';
import PacketDecodeError from './PacketDecodeError';
import {
	calculateIp6PacketChecksum,
	verifyIp6PacketChecksum
} from './checksumming';

export const ICMP_PROTOCOL_NUMBER = 58;
export const ICMP_TYPE_PING = 128;
export const ICMP_TYPE_PONG = 129;
export const ICMP_TYPE_ROUTER_SOLICITATION = 133;
export const ICMP_TYPE_ROUTER_ADVERTISEMENT = 134;
export const ICMP_TYPE_NEIGHBOR_SOLICITATION = 135;
export const ICMP_TYPE_NEIGHBOR_ADVERTISEMENT = 136;
export const ICMP_TYPE_REDIRECT = 137;

export interface ICMPMessage {
	type : number
	code : number
	checksum? : number
	// TODO: Rename to 'body'.  'payload' means something different for e.g. ping packets.
	payload : Uint8Array
}

/** The thing that comes after the IP header and starts with a type and code */
export type ICMPPacket = Uint8Array;

// ICMPv6 checksum = internetChecksum(
//   sourceAddress ++                                                     \
//   destAddress ++                                                        |
//   icmp6 packet length (32 bits) ++                                      \ Pseudo-IP-packet
//   next header (32 bits, top 24 being zeroes) ++                         /
//   type (8 bits) ++ code (8 bits) ++ zero (16 bits) ++    \ ICMP packet  |
//   icmp6 payload                                          /             /
// )

/**
 * The Internet Checksum is defined in such a way that including the checksum
 * in data being checksummed (on a 16-bit boundary, at least)
 * results in calculated checksum of 0.
 * Take advantage of this property for verification.
 */
export function verifyIcmp6PacketChecksum( sourceAddress:IP6Address, destAddress:IP6Address, icmpPacket:ICMPPacket ):boolean {
	return verifyIp6PacketChecksum( sourceAddress, destAddress, ICMP_PROTOCOL_NUMBER, icmpPacket );
}

export function extractIcmp6Checksum( icmpPacket:ICMPPacket ) {
	return new DataView(icmpPacket.buffer, icmpPacket.byteOffset, icmpPacket.byteLength).getUint16(2);
}

/** In-place checksum calculation. */
function fixIcmp6PacketChecksum( icmpPacket:ICMPPacket, sourceAddress:IP6Address, destAddress:IP6Address ):void {
	icmpPacket[2] = 0;
	icmpPacket[3] = 0;
	const checksum = calculateIp6PacketChecksum( sourceAddress, destAddress, ICMP_PROTOCOL_NUMBER, icmpPacket );
	icmpPacket[2] = checksum >> 8;
	icmpPacket[3] = checksum >> 0;
}

/**
 * Probably less efficient than building the packet in-place
 * and then calculating the checksum with fixIcmp6PacketChecksum.
 */
export function assembleIcmp6Packet( icmpMessage:ICMPMessage, sourceAddress:IP6Address, destAddress:IP6Address ):ICMPPacket {
	const packet = new Uint8Array(4 + icmpMessage.payload.length);
	packet[0] = icmpMessage.type;
	packet[1] = icmpMessage.code;
	packet.set(icmpMessage.payload, 4);
	fixIcmp6PacketChecksum( packet, sourceAddress, destAddress );
	return packet;
}

export function disassembleIcmp6Packet( packet:ICMPPacket ):ICMPMessage {
	return {
		type : packet[0],
		code : packet[1],
		checksum : (packet[2]<<8) | packet[3],
		payload : new Uint8Array(packet.buffer, packet.byteOffset+4, packet.byteLength-4),
	}
}

//// Neighbor discovery messages

export const ND_OPTION_SOURCE_LINK_LAYER_ADDRESS = 1;
export const ND_OPTION_TARGET_LINK_LAYER_ADDRESS = 2;
export const ND_OPTION_PREFIX_INFORMATION = 3;
export const ND_OPTION_REDIRECTED_HEADER = 4;
export const ND_OPTION_MTU = 5;

export interface PrefixInformation {
	prefixLength : number;
	/** The addresses covered by this prefix are (all?) on-link */
	onLink : boolean;
	/** Indicates that this link can be used for stateless address configuration (see RFC 4682) */
	autonomousAddressConfiguration : boolean;
	/** infinity encoded as 0xffffffff */
	validLifetime : number;
	preferredLifetime : number;
	prefix : Uint8Array;
}

// See RFC 3861
export interface RouterAdvertisement {
	/** Hop limit to use when sending packets; undefined encoded as 0 */
	hopLimit? : number;
	/** Addresses are available via DHCPv6.  Meaningless if hasOtherConfiguration. */
	hasManagedAddressConfiguration : boolean;
	/** Other configuration is available via DHCPv6, including addresses */
	hasOtherConfiguration : boolean;
	/** Lifetime in seconds of the 'default router'; limit = 9000; undefined encoded as 0 */
	routerLifetime? : number;
	/** Expiration time (in milliseconds) of reachability confirmations; undefined encoded as 0 */
	reachableTime? : number;
	/** Time (in milliseconds) between neighbor solicitation retransmits; undefined encoded as 0 */
	retransTime? : number;
	
	sourceLinkLayerAddress? : Uint8Array;
	mtu? : number;
	prefixInformation? : PrefixInformation;
}

function optSize( len:number ) {
	return 8 * Math.ceil(len/8);
}

function encodeOptSize( len:number ):number {
	const v = Math.ceil(len/8);
	if( v > 255 ) throw new Error("Can't encode option size; it is too big! "+len);
	return v;
}
function decodeOptSize( encoded:number ):number {
	return encoded*8;
}

function infToInt32( a:number ):number {
	return a == Infinity ? 0xFFFFFFFF : a;
}

function undefToZero( a:number|undefined ):number {
	return a == undefined ? 0 : a;
}
function zeroToUndef( a:number ):number|undefined {
	return a == 0 ? undefined : a;
}

function encodeLinkLayerAddressOption( type:number, address:Uint8Array, buffer:Uint8Array, dv:DataView, offset:number ):number {
	buffer[offset+0] = type;
	const wordCount = buffer[offset+1] = encodeOptSize(address.length+2);
	buffer.set(address, offset+2);
	return offset+wordCount*8;
}
function encodeMtuOption( mtu:number, buffer:Uint8Array, dv:DataView, offset:number ):number {
	buffer[offset] = ND_OPTION_MTU;
	buffer[offset+1] = 1;
	dv.setUint32(offset+4, mtu);
	return offset+8;
}
function encodePrefixInformationOption(pi:PrefixInformation, buffer:Uint8Array, dv:DataView, offset:number):number {
	buffer[offset] = ND_OPTION_PREFIX_INFORMATION;
	buffer[offset+1] = 4;
	buffer[offset+2] = pi.prefixLength;
	buffer[offset+3] = (pi.onLink ? 0x80 : 0) | (pi.autonomousAddressConfiguration ? 0x40 : 0);
	dv.setUint32( offset+4, infToInt32(pi.validLifetime) );
	dv.setUint32( offset+8, infToInt32(pi.preferredLifetime) );
	buffer.set(pi.prefix, 16);
	return offset+32;
}

export function assembleRouterAdvertisementIcmp6Packet(
	ra:RouterAdvertisement, sourceAddress:Uint8Array, destAddress:Uint8Array
):ICMPPacket {
	let totalLength = 16; // including ICMP header
	if( ra.sourceLinkLayerAddress ) totalLength += optSize(2+ra.sourceLinkLayerAddress.length);
	if( ra.mtu != null ) totalLength += 8;
	if( ra.prefixInformation ) totalLength += 32;
	
	const packet = new Uint8Array(totalLength);
	const v = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
	packet[0] = ICMP_TYPE_ROUTER_ADVERTISEMENT;
	packet[1] = 0;
	// checksum will go here
	packet[4] = undefToZero(ra.hopLimit);
	packet[5] = (ra.hasManagedAddressConfiguration ? 0x80 : 0) | (ra.hasOtherConfiguration ? 0x40 : 0);
	v.setUint16( 6, undefToZero(ra.routerLifetime));
	v.setUint32( 8, undefToZero(ra.reachableTime));
	v.setUint32(12, undefToZero(ra.retransTime));
	
	let offset = 16;
	if( ra.sourceLinkLayerAddress ) offset = encodeLinkLayerAddressOption(
		ND_OPTION_SOURCE_LINK_LAYER_ADDRESS, ra.sourceLinkLayerAddress, packet, v, offset);
	if( ra.mtu ) offset = encodeMtuOption(ra.mtu, packet, v, offset);
	if( ra.prefixInformation ) offset = encodePrefixInformationOption(ra.prefixInformation, packet, v, offset);
	
	if( offset != totalLength ) throw new Error(
		"Somehow offset didn't come out the same as precalculated total length "+
		"(of router advertisement ICMP6 packet): "+offset+" != "+totalLength);
	
	fixIcmp6PacketChecksum( packet, sourceAddress, destAddress );
	return packet;
}

function decodePrefixInformationOption(packet:ICMPPacket, dv:DataView, offset:number, optSize:number):PrefixInformation {
	if( optSize < 32 ) throw new PacketDecodeError("Prefix information option too small at only "+optSize+" of expected 32 bytes");
	
	return {
		prefixLength     : packet[offset+2],
		onLink: (packet[offset+3] & 0x80) != 0,
		autonomousAddressConfiguration: (packet[offset+3] & 0x40) != 0,
		validLifetime    : dv.getUint32(offset+4),
		preferredLifetime: dv.getUint32(offset+8),
		prefix: Uint8Array.from(packet.slice(offset+16, offset+32)),
	};
}

export function disassembleRouterAdvertisementIcmp6Packet(
	icmpPacket:ICMPPacket
):RouterAdvertisement {
	if( icmpPacket.length < 16 ) throw new PacketDecodeError("ICMP packet too short to be router advertisement: "+icmpPacket.length);
	
	const dv = new DataView(icmpPacket.buffer, icmpPacket.byteOffset, icmpPacket.byteLength);
	
	const ra:RouterAdvertisement = {
		hopLimit: zeroToUndef(icmpPacket[4]),
		hasManagedAddressConfiguration: (icmpPacket[5] & 0x80) != 0,
		hasOtherConfiguration: (icmpPacket[5] & 0x40) != 0,
		routerLifetime: zeroToUndef(dv.getUint16( 6)),
		reachableTime:  zeroToUndef(dv.getUint32( 8)),
		retransTime:    zeroToUndef(dv.getUint32(12)),
	};
	let offset = 16;
	while( offset <= icmpPacket.length+2 ) {
		const optType = icmpPacket[offset];
		const optSize = decodeOptSize(icmpPacket[offset+1]);
		if( optSize + offset > icmpPacket.length ) {
			throw new PacketDecodeError(
				"Option at "+offset+" (size="+optSize+
					") extends past end of ICMP packet (size="+icmpPacket.length+")");
		}
		switch( optType ) {
		case ND_OPTION_PREFIX_INFORMATION:
			ra.prefixInformation = decodePrefixInformationOption(icmpPacket, dv, offset, optSize);
			break;
		case ND_OPTION_MTU:
			if( optSize < 8 ) throw new PacketDecodeError("MTU option too small at only "+optSize+" of expected 8 bytes");
			ra.mtu = dv.getUint32(offset+4);
			break;
		default:
			// don't care; deal with it when needed
			break;
		}
		offset += optSize;
	}
	return ra;
}

/*
Neighbor discovery options are encoded in such a way
that functions to extract their 'payload' don't make much sense.

export interface NeighborDiscoveryOption {
	type : number;
	packet? : Uint8Array;
	payload? : Uint8Array;
}

export function encodeNeighborDiscoveryOptions( options:NeighborDiscoveryOption[], dest?:Uint8Array, offset:number=0 ):number {
	for( let i in options ) {
		const opt = options[i];
		const pl = opt.payload;
		const lengthInOctets = 2 + pl.length;
		const lengthInWords = Math.ceil(length / 8);
		if( lengthInWords > 255 ) throw new Error("Can't encode neighbor discovery option because payload is too long!");
		if( opt.type < 0 || opt.type > 255 ) throw new Error("Invalid neighbor discovery option type: "+opt.type);
		const endOffset = offset + lengthInWords;
		if( dest ) {
			dest[offset++] = opt.type;
			dest[offset++] = lengthInWords;
			for( let i = 0; i < pl.length; ++i ) {
				dest[offset++] = pl[i];
			}
			while( offset < endOffset ) dest[offset++] = 0; // Padding
		} else {
			offset = endOffset;
		}
	}
	return totalLength;
}

export function decodeNeighborDiscoveryOptions( encoded:Uint8Array ):NeighborDiscoveryOption[] {
	if( encoded.length % 8 != 0 ) throw new PacketDecodeError("neighbor discovery options length not multiple of 8: "+encoded.length);
	const opts : NeighborDiscoveryOption[] = [];
	let offset = 0;
	while( offset < encoded.length ) {
		const type = encoded[offset];
		const lengthInWords = encoded[offset+1];
		const lengthInOctets = lengthInWords*8;
		opts.push({ type: type, payload: new Uint8Array(encoded.buffer, encoded.offsetBytes+offset+2, lengthInOctets-2)});
	}
}
*/
