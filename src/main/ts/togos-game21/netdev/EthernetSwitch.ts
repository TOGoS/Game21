import { thaw } from '../DeepFreezer';
import EntitySystemBusMessage from '../EntitySystemBusMessage';
import NetworkDeviceSimulator from './NetworkDeviceSimulator';
import LinkAwareDevice, {LinkAwareDeviceSimulator} from './LinkAwareDevice';
import MACAddressMap, * as mam from '../inet/MACAddressMap';
import DuplicatePacketTable, * as dpt from '../inet/DuplicatePacketTable';

interface ForwardRecord {
	linkPath: string;
	lastPacketTime: number;
}

interface EthernetSwitch extends LinkAwareDevice {
	forwardTable:MACAddressMap<ForwardRecord>;
	forwardTimeout:number;
	duplicatePacketTable:DuplicatePacketTable;
}
type Device = EthernetSwitch;

import { utf8Decode } from 'tshash/utils';

export class EthernetSwitchSimulator extends LinkAwareDeviceSimulator<Device,Uint8Array> implements NetworkDeviceSimulator<Device,Uint8Array> {
	protected currentTime:number;
	createDevice():Device {
		return {
			linkPaths: [],
			forwardTable: mam.createTable<ForwardRecord>(),
			forwardTimeout: 10,
			duplicatePacketTable: dpt.makeDuplicatePacketTable(),
		};
	}
	packetReceived(device:Device, linkPath:string, packet:Uint8Array, busMessageQueue:EntitySystemBusMessage[]):Device {
		// Drop packets that are too short to be ethernet frames
		if( packet.length < 14 ) {
			//console.log("Packet not long enough ("+packet.length+" bytes); dropping!");
			return device;
		}
		
		// Drop duplicate packets
		let updatedDpt = dpt.checkPacket(packet, this.currentTime, device.duplicatePacketTable);
		if( updatedDpt == null ) {
			//console.log("Packet is duplicate!  dropping!")
			return device;
		}
		
		// Update duplicate packet table
		device = thaw(device);
		device.duplicatePacketTable = updatedDpt;
		// ...and forward table with source address and link path
		device.forwardTable = mam.addEntry(device.forwardTable, packet, 6, {
			linkPath, lastPacketTime: this.currentTime
		})
		
		// Figure out where to forward to
		let dest = mam.getEntry(device.forwardTable, packet, 0);
		let forwardLinkPaths:string[];
		if( dest == undefined || dest.lastPacketTime + device.forwardTimeout < this.currentTime ) {
			// We gotta send it to everyone
			//console.log("Unknown destination "+utf8Decode(packet.slice(0,6)));
			forwardLinkPaths = device.linkPaths;
		} else {
			//console.log("Destination "+utf8Decode(packet.slice(0,6))+" is on link "+dest.linkPath);
			forwardLinkPaths = [dest.linkPath];
		}
		
		for( let i in forwardLinkPaths ) {
			const destLinkPath = forwardLinkPaths[i];
			if( destLinkPath !== linkPath ) {
				// Never forward back to sender; that would be silly!
				busMessageQueue.push( [destLinkPath, packet, linkPath] );
			}
		}
		return device;
	}
	update(device:Device, time:number, busMessageQueue:EntitySystemBusMessage[]):Device {
		this.currentTime = time;
		return device;
	}
	getNextAutoUpdateTime(device:Device):number { return Infinity }
}

export default EthernetSwitch;
