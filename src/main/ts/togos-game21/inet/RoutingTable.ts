import KeyedList from '../KeyedList';
import { hexEncode } from '../../tshash/utils';
import IPAddress, { clearNonPrefixBits } from './IPAddress';

interface Route<Iface> {
	address:IPAddress;
	prefixLength:number;
	destination:Iface;
}

function addrAndPrefixLengthToString( address:IPAddress, prefixLength:number ) {
	return hexEncode(clearNonPrefixBits(address, prefixLength))+'/'+prefixLength;
}

export default class RoutingTable<Iface> {
	protected routes:KeyedList<Route<Iface>> = {};
	
	public eachRoute( callback:(prefix:IPAddress, prefixLen:number, dest:Iface)=>void ) {
		for( let i in this.routes ) {
			const route = this.routes[i];
			callback( route.address, route.prefixLength, route.destination );
		}
	}
	
	public addRoute( addr:IPAddress, prefixLen:number, dest:Iface ) {
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
	public routeExistsFor( addr:IPAddress, prefixLen:number ) {
		return this.routes[addrAndPrefixLengthToString(addr, prefixLen)] != null;
	}
	public removeRouteFor( addr:IPAddress, prefixLen:number ) {
		delete this.routes[addrAndPrefixLengthToString(addr, prefixLen)];
	}
	public removeRoutesTo( dest:Iface ) {
		for( let r in this.routes ) {
			if( this.routes[r].destination == dest ) delete this.routes[r];
		}
	}
	public findDestination( addr:IPAddress ):Iface|null {
		let longestMatchingPrefixLength = 0;
		let closest:Iface|null = null;
		routeLoop: for( let r in this.routes ) {
			const route = this.routes[r];
			const rPl = route.prefixLength;
			if( longestMatchingPrefixLength > rPl ) continue routeLoop; // Already found a better one
			const rAddr = route.address;
			// TODO: Move this to some address comparison function,
			// support non-*8 lengths.
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
