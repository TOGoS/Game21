import KeyedList from '../KeyedList';
import { thaw } from '../DeepFreezer';
import EntitySystemBusMessage from '../EntitySystemBusMessage';
import NetworkDeviceSimulator from './NetworkDeviceSimulator';
import LinkAwareDevice, {LinkAwareDeviceSimulator} from './LinkAwareDevice';
import MACAddressMap, * as mam from '../inet/MACAddressMap';
import DuplicatePacketTable, * as dpt from '../inet/DuplicatePacketTable';

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
	tableSize: number; // total number of entries in table
	table1Size: number; // total number of entries in table1
	maxTableSize: number; // Don't let it get bigger than this!
	table: ARPRecord[];
	table1: ARPRecord[];
}
interface IPRouter extends LinkAwareDevice {
	arpTable: ARPTable;
	routingTable: RoutingTable;
}
type Device = IPRouter;

import { utf8Decode } from 'tshash/utils';

export class EthernetSwitchSimulator extends LinkAwareDeviceSimulator<Device,Uint8Array> implements NetworkDeviceSimulator<Device,Uint8Array> {
	protected currentTime:number;
	createDevice():Device {
		throw new Error("Not implemented yet...");
	}
	packetReceived(device:Device, linkPath:string, packet:Uint8Array, busMessageQueue:EntitySystemBusMessage[]):Device {
		// TODO!
	}
	update(device:Device, time:number, busMessageQueue:EntitySystemBusMessage[]):Device {
		this.currentTime = time;
		return device;
	}
	getNextAutoUpdateTime(device:Device):number { return Infinity }
}

export default IPRouter;
