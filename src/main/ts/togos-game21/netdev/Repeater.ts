import { thaw } from '../DeepFreezer';
import EntitySystemBusMessage from '../EntitySystemBusMessage';
import NetworkDeviceSimulator from './NetworkDeviceSimulator';
import LinkAwareDevice, {LinkAwareDeviceSimulator} from './LinkAwareDevice';

export type Repeater = LinkAwareDevice;
type Device = Repeater;

export class RepeaterSimulator<Packet> extends LinkAwareDeviceSimulator<Device,Packet> implements NetworkDeviceSimulator<Device,Packet> {
	createDevice():Device {
		return { linkPaths: [] };
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
