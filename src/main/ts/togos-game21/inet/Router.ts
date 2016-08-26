import RoutingTable from './RoutingTable';
import {
	IPMessage,
	assembleIpPacket,
	disassembleIpPacket
} from './ip';
import {
	ICMP_PROTOCOL_NUMBER,
	ICMP_TYPE_PING,
	ICMP_TYPE_PONG,
	ICMPMessage,
	verifyIcmp6PacketChecksum,
	assembleIcmp6Packet,
	disassembleIcmp6Packet,
	RouterAdvertisement,
	PrefixInformation,
	assembleRouterAdvertisementIcmp6Packet
} from './icmp6';
import PacketDecodeError from './PacketDecodeError';
import KeyedList from '../KeyedList';
import { compareByteArrays } from '../util';
import IPAddress, { prefixMatches, clearNonPrefixBits, stringifyIpAddress } from './IPAddress';
import { ALL_NODES_ADDRESS, UNSPECIFIED_ADDRESS } from './IP6Address';

export type PacketHandler = (packet:Uint8Array)=>void;

// TODO: Allow links to be added to a bridge
// and forward link broadcast packets across them

export interface Link {
	/** Incoming packets should be passed to handler */
	setUp(handler:PacketHandler):void;
	/** Don't deliver any more packets. */
	setDown():void;
	/** Send an outgoing packet */
	send(packet:Uint8Array):void;
}

export type LinkID = string;
export type SubnetPoolID = string;

interface AutoRoutePrefix {
	address : IPAddress;
	triggerPrefixLength : number;
	routePrefixLength : number;
}

import Logger, {
	VERBOSITY_SILENT,
	VERBOSITY_ERRORS,
	VERBOSITY_WARNINGS,
	VERBOSITY_INFO,
	VERBOSITY_DEBUG,
} from '../Logger';

interface SubnetPool {
	prefix : Uint8Array;
	prefixLength : number;
	/** Number of bits after the prefix to identify each subnet */
	subnetBits : number;
}

interface LinkOptions {
	sendRouterAdvertisements? : boolean;
	// subnetPoolId? : SubnetPoolID; // not implemented!
}

export default class Router
{
	protected nextLinkId:number = 1;
	protected routingTable:RoutingTable<LinkID>= new RoutingTable<LinkID>();
	protected links : KeyedList<Link> = {}
	public logger : Logger;
	public verbosity : number = VERBOSITY_WARNINGS;
	public routerAddress? : Uint8Array;
	public shouldRespondToPings : boolean = false;
	public shouldSendUnreachabilityMessages : boolean = false;
	public internalLinkId = "internal";
	protected autoRoutePrefixes:AutoRoutePrefix[] = [];
	
	public newLinkId(pfx?:string) {
		if( !pfx ) pfx = "link";
		return pfx+this.nextLinkId++;
	}
	
	public eachRoute( callback:(prefix:Uint8Array, prefixLen:number, dest:LinkID)=>void ) {
		this.routingTable.eachRoute( callback );
	}

	protected isRouterAddress( address:Uint8Array ):boolean {
		const ra = this.routerAddress
		if( !ra ) return false;
		return compareByteArrays(ra, address) == 0;
	}
	
	protected handleOwnIcmpMessage( icmpMessage:ICMPMessage, ipMessage:IPMessage, sourceLinkId?:LinkID ):void {
		if( !this.shouldRespondToPings ) return;
		if( icmpMessage.type != ICMP_TYPE_PING ) return;
		
		if( !verifyIcmp6PacketChecksum( ipMessage.sourceAddress, ipMessage.destAddress, ipMessage.payload ) ) {
			this.logger.log("Bad ICMP checksum; dropping packet");
			return;
		}
		
		const responseMessage:IPMessage = {
			ipVersion: 6,
			sourceAddress: ipMessage.destAddress,
			destAddress: ipMessage.sourceAddress,
			protocolNumber: ICMP_PROTOCOL_NUMBER,
			hopLimit: 64,
			payload: assembleIcmp6Packet({
				type: ICMP_TYPE_PONG,
				code: 0,
				payload: icmpMessage.payload,
			}, ipMessage.destAddress, ipMessage.sourceAddress)
		};
		const responsePacket = assembleIpPacket(responseMessage);
		this.route( responsePacket, responseMessage, this.internalLinkId );
	}
	
	protected handleOwnIpMessage( ipMessage:IPMessage, sourceLinkId?:LinkID ):void {
		if( ipMessage.protocolNumber == ICMP_PROTOCOL_NUMBER ) {
			const icmpMessage = disassembleIcmp6Packet(ipMessage.payload);
			this.handleOwnIcmpMessage(icmpMessage, ipMessage, sourceLinkId);
		}
	}
	
	public handlePacket( packet:Uint8Array, sourceLinkId?:LinkID ):void {
		let ipMessage:IPMessage;
		try {
			ipMessage = disassembleIpPacket(packet);
		} catch( e ) {
			if( e instanceof PacketDecodeError ) {
				this.logger.log("Failed to disassemble packet from "+sourceLinkId+": "+e.message);
				return;
			} else {
				this.logger.error("Error while decoding packet from "+sourceLinkId+": "+e.message);
				return;
			}
		}
		
		if( sourceLinkId ) {
			const sourceAddr = ipMessage.sourceAddress;
			// TODO: Maybe move core of auto routing code to RoutingTable
			autoRouteTriggerSearch: for( let i in this.autoRoutePrefixes ) {
				const arp = this.autoRoutePrefixes[i];
				const triggerPrefixLength = arp.triggerPrefixLength;
				const triggerAddr = arp.address;
				if( !prefixMatches(sourceAddr, triggerAddr, triggerPrefixLength) ) continue autoRouteTriggerSearch;
				// Ooh, triggered!
				const routePrefixLength = arp.routePrefixLength;
				const routeAddr = clearNonPrefixBits(sourceAddr, routePrefixLength);
				if( !this.routingTable.routeExistsFor(routeAddr, routePrefixLength) ) {
					this.routingTable.addRoute( routeAddr, routePrefixLength, sourceLinkId );
				}
			}
		}
		
		if( this.isRouterAddress(ipMessage.destAddress) ) {
			this.handleOwnIpMessage(ipMessage, sourceLinkId);
		} else {
			// TODO: Reduce ttl!
			this.route( packet, ipMessage, sourceLinkId );
		}
	}
	
	public route( packet:Uint8Array, ipMessage:IPMessage, sourceLinkId?:LinkID ):void {
		const destId = this.routingTable.findDestination(ipMessage.destAddress);
		if( destId == null ) {
			// TODO: send 'unreachable' message?
			this.logger.warn("Failed to find destination link for address "+stringifyIpAddress(ipMessage.destAddress));
			return;
		}
		if( destId == sourceLinkId ) {
			// Don't participate in loops
			this.logger.warn(
				"Refusing to route packet from "+sourceLinkId+" back to itself (destination "+
					stringifyIpAddress(ipMessage.destAddress)+")");
			return;
		}
		const destLink = this.links[destId];
		if( destLink == null ) {
			// Well that shouldn't happen.
			this.logger.error("Somehow routing table returned an unassociated link ID");
		}
		if( this.verbosity >= VERBOSITY_DEBUG ) {
			this.logger.debug(
				"Routing packet from "+
				stringifyIpAddress(ipMessage.sourceAddress)+" to "+
				stringifyIpAddress(ipMessage.destAddress)+" ("+
				sourceLinkId+" to "+destId+")"
			);
		}
		destLink.send(packet);
	}
	
	protected sendRouterAdvertisement( linkId:LinkID ):void {
		let prefixInformation : PrefixInformation|undefined = undefined;
		
		const link = this.links[linkId];
		if( link == null ) {
			this.logger.error("Can't send router advert on link ‹"+linkId+"› because no such link exists!");
			return;
		}
		
		// TODO: allow configuration of prefixes for each link
		// instead of assuming we want to use some autoRoutePrefix
		for( let i in this.autoRoutePrefixes ) {
			const arp = this.autoRoutePrefixes[i];
			
			prefixInformation = {
				prefix: arp.address,
				onLink: false, // Since the prefix is shared among multiple links
				prefixLength: arp.triggerPrefixLength,
				autonomousAddressConfiguration: true,
				validLifetime: Infinity, // TODO
				preferredLifetime: Infinity, // TODO
			}
			break;
		}
		
		const ra : RouterAdvertisement = {
			hopLimit: 42, // TODO configure
			hasManagedAddressConfiguration: false,
			hasOtherConfiguration: false,
			prefixInformation: prefixInformation,
			// TODO: include source link layer address?
		};
		
		const sourceAddress = this.routerAddress || UNSPECIFIED_ADDRESS;
		const destAddress   = ALL_NODES_ADDRESS;
		const raIcmpPacket = assembleRouterAdvertisementIcmp6Packet(ra, sourceAddress, destAddress);
		const raIpMessage = {
			ipVersion: 6,
			sourceAddress: sourceAddress,
			destAddress: destAddress,
			protocolNumber: ICMP_PROTOCOL_NUMBER,
			hopLimit: 64,
			payload: raIcmpPacket
		}
		const raIpPacket = assembleIpPacket( raIpMessage );
		
		link.send(raIpPacket);
	}
	
	public addLink( link:Link, linkId:LinkID, opts:LinkOptions={} ):LinkID {
		if( this.links[linkId] ) throw new Error("Link '"+linkId+"' already exists");
		this.links[linkId] = link;
		link.setUp( (packet:Uint8Array) => this.handlePacket( packet, linkId ) );
		if( opts.sendRouterAdvertisements ) {
			this.sendRouterAdvertisement( linkId );
		}
		return linkId;
	}
	
	/**
	 * Add an 'auto route prefix'.
	 * Any packet with source address matching add/triggerPrefixLength will be added to the routing table
	 * so that packets with destination addresses matching addr/routePrefixLength will then be routed
	 * back to the triggering interface.
	 * 
	 * e.g. lets say all users are under 1111:2222:3333:4444::/64,
	 * we have an auto route prefix 1111:2222:3333:4444:: triggerPrefixLength=64, routePrefixLength=96;
	 * a packet comes in from interface if123, address 1111:2222:3333:4444:5555:6666:7777:8888.
	 * Any future packets with destination matching 1111:2222:3333:4444:5555:6666::/96 will be routed to if123.
	 */
	public addAutoRoutePrefix( addr:Uint8Array, triggerPrefixLength:number, routePrefixLength:number=128 ) {
		this.autoRoutePrefixes.push({ address:addr, triggerPrefixLength:triggerPrefixLength, routePrefixLength:routePrefixLength });
	};
	
	public addRoute( addr:Uint8Array, prefixLength:number, linkId:LinkID ) {
		const link = this.links[linkId];
		if( link == null ) return;
		this.routingTable.addRoute( addr, prefixLength, linkId );
	}
	
	public removeLink( linkId:LinkID ) {
		const link = this.links[linkId];
		if( link == null ) return;
		
		link.setDown();
		this.routingTable.removeRoutesTo( linkId );
		delete this.links[linkId];
	}
	
	public shutDownAllLinks():void {
		for( let l in this.links ) {
			this.removeLink(l);
		}
	}
}
