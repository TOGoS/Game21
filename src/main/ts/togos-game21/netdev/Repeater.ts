import { thaw } from '../DeepFreezer';
import EntitySystemBusMessage from '../EntitySystemBusMessage';
import NetworkDeviceSimulator from './NetworkDeviceSimulator';

interface Repeater {
	linkPaths: string[];
}

type Device = Repeater;
type Packet = Uint8Array;

export class RepeaterSimulator implements NetworkDeviceSimulator<Repeater,Uint8Array> {
	createDevice():Device {
		return { linkPaths: [] };
	}
	linkAdded(device:Device, linkPath:string, busMessageQueue:EntitySystemBusMessage[]):Device {
		device = thaw(device);
		device.linkPaths = device.linkPaths.concat(linkPath);
		return device;
	}
	linkRemoved(device:Device, linkPath:string, busMessageQueue:EntitySystemBusMessage[]):Device {
		device = thaw(device);
		device.linkPaths = device.linkPaths.filter( (v) => v != linkPath );
		return device;
	}
	packetReceived(device:Device, linkPath:string, packet:Packet, busMessageQueue:EntitySystemBusMessage[]):Device {
		for( let i in device.linkPaths ) {
			const p = device.linkPaths[i];
			if( p != linkPath ) busMessageQueue.push( [p, packet] );
		}
		return device;
	}
	update(device:Device, time:number, busMessageQueue:EntitySystemBusMessage[]):Device {
		return device;
	}
	getNextAutoUpdateTime(device:Device):number { return Infinity }
}

export default Repeater;
