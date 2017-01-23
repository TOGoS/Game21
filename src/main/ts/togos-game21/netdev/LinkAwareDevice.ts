import { thaw } from '../DeepFreezer';
import EntitySystemBusMessage from '../EntitySystemBusMessage';
import NetworkDeviceSimulator from './NetworkDeviceSimulator';

interface LinkAwareDevice {
	linkPaths: string[];
}

type Device = LinkAwareDevice;

export abstract class LinkAwareDeviceSimulator<Device extends LinkAwareDevice, Packet> /* implements NetworkDeviceSimulator<Device,Packet> */ {
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
}

export default LinkAwareDevice;
