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
	calculateIcmp6Checksum,
	assembleIcmp6Packet,
	disassembleIcmp6Packet
} from './icmp6';
import PacketDecodeError from './PacketDecodeError';
import KeyedList from '../KeyedList';
import { compareByteArrays } from '../util';
import IPAddress, { prefixMatches, clearNonPrefixBits, stringifyIpAddress } from './IPAddress';

export type PacketHandler = (packet:Uint8Array)=>void;

export interface Link {
	/** Incoming packets should be passed to handler */
	setUp(handler:PacketHandler):void;
	/** Don't deliver any more packets. */
	setDown():void;
	/** Send an outgoing packet */
	send(packet:Uint8Array):void;
}

export type LinkID = string;

interface AutoRoutePrefix {
	address : IPAddress;
	triggerPrefixLength : number;
	routePrefixLength : number;
}

export default class Router
{
	protected nextLinkId:number = 1;
	protected routingTable:RoutingTable<LinkID>= new RoutingTable<LinkID>();
	protected links : KeyedList<Link> = {}
	public routerAddress? : Uint8Array;
	public shouldRespondToPings : boolean = false;
	public shouldSendUnreachabilityMessages : boolean = false;
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

		const calcChecksum = calculateIcmp6Checksum( ipMessage.sourceAddress, ipMessage.destAddress, icmpMessage );
		if( calcChecksum != icmpMessage.checksum ) {
			console.log("Bad ICMP checksum "+icmpMessage.checksum+" != expected "+calcChecksum);
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
		this.route( responsePacket, responseMessage );
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
				console.log("Failed to disassemble packet from "+sourceLinkId+": "+e.message);
				return;
			} else {
				console.error("Error while decoding packet from "+sourceLinkId+": "+e.message);
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
			console.warn("Failed to find destination link for address "+stringifyIpAddress(ipMessage.destAddress));
			return;
		}
		if( destId == sourceLinkId ) {
			// Don't participate in loops
			console.warn(
				"Refusing to route packet from "+sourceLinkId+" back to itself (destination "+
					stringifyIpAddress(ipMessage.destAddress)+")");
			return;
		}
		const destLink = this.links[destId];
		if( destLink == null ) {
			// Well that shouldn't happen.
			console.error("Somehow routing table returned an unassociated link ID");
		}
		console.log(
			"Routing packet from "+
			stringifyIpAddress(ipMessage.sourceAddress)+" to "+
			stringifyIpAddress(ipMessage.destAddress)+" ("+
			sourceLinkId+" to "+destId+")"
		);
		destLink.send(packet);
	}
	
	public addLink( link:Link, linkId?:LinkID, pfx?:string ):LinkID {
		if( !linkId ) linkId = this.newLinkId(pfx);
		if( this.links[linkId] ) throw new Error("Link '"+linkId+"' already exists");
		this.links[linkId] = link;
		link.setUp( (packet:Uint8Array) => this.handlePacket( packet, linkId ) );
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
