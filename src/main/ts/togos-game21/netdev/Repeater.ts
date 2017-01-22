import { thaw } from '../DeepFreezer';
import EntitySystemBusMessage from '../EntitySystemBusMessage';
import NetworkDeviceSimulator from './NetworkDeviceSimulator';

interface Repeater {
	linkPaths: string[];
}

type Device = Repeater;

export class RepeaterSimulator<Packet> implements NetworkDeviceSimulator<Repeater,Packet> {
	createDevice():Device {
		return { linkPaths: [] };
	}
	linkAdded(device:Device, linkPath:string, busMessageQueue:EntitySystemBusMessage[]):Device {
		device = thaw(device);
		//console.log("Repeater: new link! "+linkPath);
		device.linkPaths = device.linkPaths.concat(linkPath);
		return device;
	}
	linkRemoved(device:Device, linkPath:string, busMessageQueue:EntitySystemBusMessage[]):Device {
		device = thaw(device);
		device.linkPaths = device.linkPaths.filter( (v) => v != linkPath );
		return device;
	}
	packetReceived(device:Device, linkPath:string, packet:Packet, busMessageQueue:EntitySystemBusMessage[]):Device {
		//console.log("Repeater: packet from "+linkPath);
		for( let i in device.linkPaths ) {
			const destLinkPath = device.linkPaths[i];
			if( destLinkPath !== linkPath ) {
				//console.log("Repeater: forwarding packet to "+destLinkPath);
				busMessageQueue.push( [destLinkPath, packet] );
			}
		}
		return device;
	}
	update(device:Device, time:number, busMessageQueue:EntitySystemBusMessage[]):Device {
		return device;
	}
	getNextAutoUpdateTime(device:Device):number { return Infinity }
}

export default Repeater;
