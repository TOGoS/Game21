import KeyedList from '../KeyedList';
import { hexEncode } from '../../tshash/utils';

interface Route<Iface> {
	address:Uint8Array;
	prefixLength:number;
	destination:Iface;
}

function addrAndPrefixLengthToString( address:Uint8Array, prefixLength:number ) {
	return hexEncode(address)+'/'+prefixLength;
}

export default class RoutingTable<Iface> {
	protected routes:KeyedList<Route<Iface>> = {};
	
	public addRoute( addr:Uint8Array, prefixLen:number, dest:Iface ) {
		if( prefixLen % 8 != 0 ) {
			// TODO: write the comparison stuff so it doesn't have to be
			throw new Error("Route prefix length must be a multiple of 8; given "+prefixLen);
		}
		this.routes[addrAndPrefixLengthToString(addr, prefixLen)] = {
			address: addr,
			prefixLength: prefixLen,
			destination: dest,
		};
	}
	public removeRouteFor( addr:Uint8Array, prefixLen:number ) {
		delete this.routes[addrAndPrefixLengthToString(addr, prefixLen)];
	}
	public removeRoutesTo( dest:Iface ) {
		for( let r in this.routes ) {
			if( this.routes[r].destination == dest ) delete this.routes[r];
		}
	}
	public findDestination( addr:Uint8Array ):Iface {
		let longestMatchingPrefixLength = 0;
		let closest:Iface = null;
		routeLoop: for( let r in this.routes ) {
			const route = this.routes[r];
			const rPl = route.prefixLength;
			if( longestMatchingPrefixLength > rPl ) continue routeLoop; // Already found a better one
			const rAddr = route.address;
			for( let i = 0; i < rPl/8; ++i ) {
				if( addr[i] != rAddr[i] ) continue routeLoop;
			}
			// Otherwise it matches and is the new longest one, hey hey!
			longestMatchingPrefixLength = rPl;
			closest = route.destination;
		}
		return closest;
	}
}
