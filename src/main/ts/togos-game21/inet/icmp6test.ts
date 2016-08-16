import { hexEncode } from '../../tshash/utils';
import { assertEqualsPromise, registerTestResult } from '../testing';
import { parseIp6Address } from './IP6Address'
import {
	assembleRouterAdvertisementIcmp6Packet,
	PrefixInformation,
	RouterAdvertisement
} from './icmp6';

// Uhm, let's try making a router advertisement packet.
registerTestResult("icmp6test: simple router advertisement", new Promise( (resolve,reject) => {
	const ra = {
		hopLimit: 24,
		hasManagedAddressConfiguration: false,
		hasOtherConfiguration: false,
	}
	
	const routerAddress = parseIp6Address('fe80:0002::1');
	const hostAddress   = parseIp6Address('fe80:0002::2');
	
	const raIcmpPacket = assembleRouterAdvertisementIcmp6Packet(ra, routerAddress, hostAddress);
	if( raIcmpPacket.length == 0 ) {
		resolve({errors:[new Error("Assembled packet has zero length!")]});
		return;
	}
	// TODO: Parse packet, make sure everything's the same.
	resolve({});
}));
