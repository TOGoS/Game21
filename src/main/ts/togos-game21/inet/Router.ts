import RoutingTable from './RoutingTable';
import {
	IPMessage,
	assembleIpPacket,
	disassembleIpPacket
} from './ip';
import { stringifyIp6Address } from './IP6Address';
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

export default class Router
{
	protected nextLinkId:number = 1;
	protected routingTable:RoutingTable<LinkID>= new RoutingTable<LinkID>();
	protected links : KeyedList<Link> = {}
	public routerAddress? : Uint8Array;
	public shouldRespondToPings : boolean = false;
	public shouldSendUnreachabilityMessages : boolean = false;
	
	public newLinkId(pfx?:string) {
		if( !pfx ) pfx = "link";
		return pfx+this.nextLinkId++;
	}
	
	protected isRouterAddress( address:Uint8Array ):boolean {
		const ra = this.routerAddress
		if( !ra ) return false;
		if( address.length != ra.length ) return false;
		for( let i = address.length-1; i >= 0; --i ) {
			if( ra[i] != address[i] ) return false;
		}
		return true;
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
		
		if( this.isRouterAddress(ipMessage.destAddress) ) {
			this.handleOwnIpMessage(ipMessage, sourceLinkId);
		} else {
			this.route( packet, ipMessage, sourceLinkId );
		}
	}
	
	public route( packet:Uint8Array, ipMessage:IPMessage, sourceLinkId?:LinkID ):void {
		const destId = this.routingTable.findDestination(ipMessage.destAddress);
		if( destId == null ) {
			// TODO: send 'unreachable' message?
			console.warn("Failed to find destination link for address "+stringifyIp6Address(ipMessage.destAddress));
			return;
		}
		if( destId == sourceLinkId ) {
			// Don't participate in loops
			console.warn(
				"Refusing to route packet from "+sourceLinkId+" back to itself (destination "+
					stringifyIp6Address(ipMessage.destAddress));
			return;
		}
		const destLink = this.links[destId];
		if( destLink == null ) {
			// Well that shouldn't happen.
			console.error("Somehow routing table returned an unassociated link ID");
		}
		destLink.send(packet);
	}
	
	public addLink( link:Link, linkId?:LinkID, pfx?:string ):LinkID {
		if( !linkId ) linkId = this.newLinkId(pfx);
		if( this.links[linkId] ) throw new Error("Link '"+linkId+"' already exists");
		this.links[linkId] = link;
		link.setUp( (packet:Uint8Array) => this.handlePacket( packet, linkId ) );
		return linkId;
	}
	
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
}
