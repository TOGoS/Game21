import { hexEncode } from '../../tshash/utils';
import { assertEqualsPromise, registerTestResult, assertEquals } from '../testing';
import { parseIp6Address } from './IP6Address'
import {
	assembleRouterAdvertisementIcmp6Packet,
	disassembleIcmp6Packet,
	disassembleRouterAdvertisementIcmp6Packet,
	extractIcmp6Checksum,
	verifyIcmp6PacketChecksum,
	PrefixInformation,
	RouterAdvertisement
} from './icmp6';

// Uhm, let's try making a router advertisement packet.
registerTestResult("icmp6test: simple router advertisement", new Promise( (resolve,reject) => {
	const ra = {
		hopLimit: 24,
		hasManagedAddressConfiguration: false,
		hasOtherConfiguration: false,
		mtu: 67,
		prefixInformation: {
			prefixLength: 96,
			onLink: false,
			autonomousAddressConfiguration: true,
			validLifetime: Infinity,
			preferredLifetime: Infinity,
			prefix: parseIp6Address('fe80:0001:0002:0003:0004:0005::'),
		}
	}
	// TODO: include prefix information and stuff
	
	const routerAddress = parseIp6Address('fe80:0002::1');
	const hostAddress   = parseIp6Address('fe80:0002::2');
	
	const raIcmpPacket = assembleRouterAdvertisementIcmp6Packet(ra, routerAddress, hostAddress);
	if( raIcmpPacket.length == 0 ) {
		resolve({errors:[new Error("Assembled packet has zero length!")]});
		return;
	}
	
	const raIcmpMessage = disassembleIcmp6Packet( raIcmpPacket );
	
	const extractedChecksum = extractIcmp6Checksum( raIcmpPacket );
	if( extractedChecksum != raIcmpMessage.checksum ) {
		resolve({errors:[new Error("extracted checksum different ways is different! "+extractedChecksum+" != "+raIcmpMessage.checksum)]});
		return;
	}
	
	const verified = verifyIcmp6PacketChecksum( routerAddress, hostAddress, raIcmpPacket );
	if( !verified ) {
		resolve({errors:[new Error("ICMP6 packet checksum did not verify")]});
		return;
	}
	
	const disassembledRa = disassembleRouterAdvertisementIcmp6Packet(raIcmpPacket);
	assertEquals(ra, disassembledRa);
	
	// TODO: Parse packet, make sure everything's the same.
	resolve({});
}));
