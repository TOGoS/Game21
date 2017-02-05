import { thaw } from '../DeepFreezer';
import { utf8Encode } from 'tshash';
import EntitySystemBusMessage from '../EntitySystemBusMessage';
import NetworkDeviceSimulator from './NetworkDeviceSimulator';
import LinkAwareDevice, {LinkAwareDeviceSimulator} from './LinkAwareDevice';

interface JunkSpammer extends LinkAwareDevice {
	linkPaths: string[];
	lastSpamTime: number;
	spamInterval: number;
	nextLinkIndex: number;
	spamMode: "rotate"|"broadcast";
	nextJunkNumber: number;
	junkPrefix: string;
}

type Device = JunkSpammer;
type Packet = Uint8Array;

export class JunkSpammerSimulator extends LinkAwareDeviceSimulator<Device,Packet> implements NetworkDeviceSimulator<Device,Uint8Array> {
	protected currentTime:number = -Infinity;
	createDevice(options:any):Device {
		return {
			linkPaths: [],
			lastSpamTime: -Infinity,
			spamInterval: +options.interval || 1,
			nextLinkIndex: 0,
			spamMode: options.spamMode === "rotate" ? "rotate" : "broadcast",
			nextJunkNumber: 1000,
			junkPrefix: options.junkPrefix || "Junk ",
		};
	}
	packetReceived(device:Device, linkPath:string, packet:Packet, busMessageQueue:EntitySystemBusMessage[]):Device {
		return device;
	}
	update(device:Device, time:number, busMessageQueue:EntitySystemBusMessage[]):Device {
		this.currentTime = time;
		if( device.lastSpamTime+device.spamInterval <= time ) {
			device = thaw(device);
			const spamMessage = device.junkPrefix+(device.nextJunkNumber++);
			const spamMessageBytes = utf8Encode(spamMessage);
			if( device.spamMode == "broadcast" ) {
				for( let i in device.linkPaths ) {
					const linkPath = device.linkPaths[i];
					//console.log("Broadcasting junk to "+linkPath+": "+spamMessage);
					busMessageQueue.push([linkPath, spamMessageBytes]);
				}
			} else {
				let linkIndex = device.nextLinkIndex;
				if( linkIndex >= device.linkPaths.length ) linkIndex = 0;
				device.nextLinkIndex = linkIndex+1;
				const linkPath = device.linkPaths[linkIndex];
				if( linkPath ) {
					//console.log("Rotatedly spamming junk to "+linkPath+": "+spamMessage);
					busMessageQueue.push([linkPath, spamMessageBytes]);
				}
			}
			device.lastSpamTime = time;
		}
		return device;
	}
	getNextAutoUpdateTime(device:Device):number {
		return Math.max(device.lastSpamTime+device.spamInterval, this.currentTime);
	}
}

export default JunkSpammer;
