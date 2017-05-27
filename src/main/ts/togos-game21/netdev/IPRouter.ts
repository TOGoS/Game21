import KeyedList from '../KeyedList';
import { thaw } from '../DeepFreezer';
import EntitySystemBusMessage from '../EntitySystemBusMessage';
import NetworkDeviceSimulator from './NetworkDeviceSimulator';
import LinkAwareDevice, {LinkAwareDeviceSimulator} from './LinkAwareDevice';
import MACAddressMap, * as mam from '../inet/MACAddressMap';
import { crc32 } from 'tshash/CRC32';
import DuplicatePacketTable, * as dpt from '../inet/DuplicatePacketTable';
import { ETHERTYPE_IP } from '../inet/ethernet';
import { disassembleIpPacket, IPMessage } from '../inet/ip';

/**
 * Oh boy, here we go.  This one is probably going to get complicated.
 * These things can stand on their own as routers,
 * but since there's a lot of overlap in the functionality of routers and hosts,
 * (e.g. MAC address lookups)
 * may want to also re-use these for hosts, too. 
 * 
 * Applications may be implemented as separate devices that talk via the message bus.
 */

interface InterfaceBridge {
	linkPaths: string[];
}
interface Route {
	prefix: Uint8Array;
	prefixLength: number; // Number of bits
	destinationLinkPath: string; // Which link to send to
	gatewayIpAddress?: Uint8Array;
	gatewayMacAddress?: Uint8Array;
}
interface RoutingTable {
	routes: Route[];
}
interface ARPRecord {
	ipAddress: Uint8Array;
	macAddress: Uint8Array|undefined;
	lastReceivedTime: number; // Last time we've heard from this guy
	lastSentTime: number; // Last time we broadcast to this guy
	next: ARPRecord|undefined;
}
// Hash table using CRC32 of IP addresses
interface ARPTable {
	hashMask: number; // e.g. 0xFF to have at most 256 entries
	table0Size: number; // total number of entries in table
	table1Size: number; // total number of entries in table1
	maxTableSize: number; // Don't let it get bigger than this!
	table0: ARPRecord[];
	table1: ARPRecord[];
}
interface IPRouter extends LinkAwareDevice {
	arpTable: ARPTable;
	routingTable: RoutingTable;
}
type Device = IPRouter;

import { utf8Decode } from 'tshash/utils';

function destRouteForIp(device:Device, destIp:Uint8Array):Route|undefined {
	let longestMatchingPrefixLength = 0;
	let bestMatch:Route|undefined = undefined;
	const routes = device.routingTable.routes;
	findRoute: for( let i=0; i<routes.length; ++i ) {
		const route = routes[i];
		if( route.prefixLength <= longestMatchingPrefixLength ) continue;
		if( route.prefix.length != destIp.length ) continue;
		for( let j=0; j<route.prefixLength; ++j ) {
			if( route.prefix[j] != destIp[j] ) continue findRoute;
		}
		longestMatchingPrefixLength = route.prefixLength;
		bestMatch = route;
	}
	return bestMatch;
}

function arrayEq<T>( a:ArrayLike<T>, b:ArrayLike<T> ):boolean {
	if( a.length != b.length ) return false;
	for( let i=0; i<a.length; ++i ) if( a[i] != b[i] ) return false;
	return true;
}

let updatedArpTable:ARPTable;
let foundRecord:ARPRecord|undefined;
function readArpTable( arpTable:ARPTable, ipAddress:Uint8Array ):void {
	updatedArpTable = arpTable;
	foundRecord = undefined;

	const index = crc32(ipAddress) & arpTable.hashMask;
	let record:ARPRecord|undefined = arpTable.table0[index];
	while( record ) {
		if( arrayEq(ipAddress, record.ipAddress) ) {
			foundRecord = record;
			return;
		}
		record = record.next;
	}
	
	record = arpTable.table1[index];
	while( record ) {
		if( arrayEq(ipAddress, record.ipAddress) ) {
			// TODO: Move from table1 back into table0 
			foundRecord = record;
			return;
		}
		record = record.next;
	}
}

export class EthernetSwitchSimulator extends LinkAwareDeviceSimulator<Device,Uint8Array> implements NetworkDeviceSimulator<Device,Uint8Array> {
	protected currentTime:number;
	createDevice():Device {
		return {
			linkPaths: [],
			arpTable: {
				maxTableSize: 128,
				table0Size: 0,
				table1Size: 0,
				hashMask: 0xFFFF,
				table0: [],
				table1: [],
			},
			routingTable: {
				routes: []
			},
		}
	}
	packetReceived(device:Device, linkPath:string, packet:Uint8Array, busMessageQueue:EntitySystemBusMessage[]):Device {
		if( packet.length < 14 ) return device;
		
		const etherType = (packet[12]<<8) | packet[13]; 
		
		if( etherType != ETHERTYPE_IP ) return device;
		
		const ipMessage:IPMessage = disassembleIpPacket(packet.slice(14));
		if( ipMessage.hopLimit == 0 ) return device;
		
		const destRoute = destRouteForIp(device, ipMessage.destAddress);
		if( destRoute ) {
			// Reconstruct packet with ttl-1
			const forwardedPacket = new Uint8Array(packet);
			forwardedPacket[14+7] -= 1;
			// TODO: Look up MAC address in ARP table
			// or take from gateway if defined
			// Also decrement ttl/hopCount.
			busMessageQueue.push([destRoute.destinationLinkPath, forwardedPacket]);
		}
		
		return device;
	}
	update(device:Device, time:number, busMessageQueue:EntitySystemBusMessage[]):Device {
		this.currentTime = time;
		return device;
	}
	getNextAutoUpdateTime(device:Device):number { return Infinity }
}

export default IPRouter;
