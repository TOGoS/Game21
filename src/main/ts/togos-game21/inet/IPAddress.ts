/**
 * Functions common to IP4 and IP6 addresses.
 */

import { stringifyIp6Address } from './IP6Address';

type IPAddress = Uint8Array;

export function clearNonPrefixBits( address:Uint8Array, prefixLength:number ):Uint8Array {
	if( prefixLength == address.length ) return address;
	const cleared = new Uint8Array(address.length);
	if( prefixLength % 8 != 0 ) throw new Error("clearNonPrefixBits for non-multiple-of-8 prefixes not yet implemented!");
	const prefixByteLength = prefixLength / 8;
	for( let i=0; i < prefixByteLength; ++i ) cleared[i] = address[i];
	return cleared;
}

export function prefixMatches( address:Uint8Array, prefix:Uint8Array, prefixLength:number ):boolean {
	if( prefixLength % 8 != 0 ) throw new Error("Matching non-multiple-of-8 prefixes not yet implemented");
	for( let i=0; i<prefixLength; i+=8 ) {
		const bi = i/8;
		if( address[bi] != prefix[bi] ) return false;
	}
	return true;
}

export function stringifyIpAddress( address:Uint8Array ):string {
	if( address.length == 16 ) {
		return stringifyIp6Address(address);
	} else if( address.length == 4 ) {
		throw new Error("Stringifying IP4 addresses not yet suppoerted");
	}
	throw new Error("Unsupported IP address length "+address.length);
}

export default IPAddress;
