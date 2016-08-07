import RoutingTable from './RoutingTable';
import { IPMessage, disassembleIpPacket } from './ip';
import PacketDecodeError from './PacketDecodeError';
import KeyedList from '../KeyedList';

type PacketHandler = (packet:Uint8Array)=>void;

export interface Link {
	/** Incoming packets should be passed to handler */
	setUp(handler:PacketHandler):void;
	/** Don't deliver any more packets. */
	setDown():void;
	/** Send an outgoing packet */
	send(packet:Uint8Array):void;
}

type LinkID = string;

export default class Router
{
	protected nextLinkId:number = 1;
	protected routingTable:RoutingTable<LinkID>= new RoutingTable<LinkID>();
	protected links : KeyedList<Link> = {}
	public routerAddress? : Uint8Array;
	public shouldRespondToPings : boolean = false;
	public shouldSendUnreachablilityMessages : boolean = false;
	
	public newLinkId(pfx?:string) {
		if( !pfx ) pfx = "link";
		return pfx+this.nextLinkId++;
	}
	
	public handlePacket( packet:Uint8Array, sourceLinkId?:LinkID ) {
		let ipMessage:IPMessage;
		try {
			ipMessage = disassembleIpPacket(packet);
		} catch( e ) {
			if( e instanceof PacketDecodeError ) {
				console.log("Failed to decode packet from "+sourceLinkId+": "+e.message);
				return;
			} else {
				console.error("Error while decoding packet from "+sourceLinkId+": "+e.message);
				return;
			}
		}
		
		const destId = this.routingTable.findDestination(ipMessage.destAddress);
		if( destId == null ) {
			// TODO: send 'unreachable' message?
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
