import KeyedList from '../KeyedList';
import NetworkDeviceSimulator from './NetworkDeviceSimulator';
import MessageLink from '../sock/MessageLink';
import EntitySystemBusMessage from '../EntitySystemBusMessage';

/**
 * Create and simulate a single network device
 * connected to 'physical' (not themselves simulated) links.
 * 
 * Logical simulation layers:
 *   Runner (CLI, browser-based)
 *   Shell (this thing; manages connections, timing; separates 'pure' simulation from rest of the program)
 *   Simulator (implements behavior, response to events in shell-agnostic way)
 *   State (actual data)
 */
export default class NetworkDeviceShell<Device,Message> {
	protected links:KeyedList<MessageLink<Message>> = {};
	protected nextLinkId = 1;
	protected device : Device;
	protected busMessageQueue:EntitySystemBusMessage[] = [];
	
	public constructor(
		protected simulator : NetworkDeviceSimulator<Device,Message>,
		device? : Device
	) {
		this.device = device || simulator.createDevice({});
	}
	
	protected processQueuedMessages() {
		const oldMessageQueue = this.busMessageQueue;
		this.busMessageQueue = [];
		for( let i=0; i<oldMessageQueue.length; ++i ) {
			const message = oldMessageQueue[i];
			const outLink = this.links[message[0]];
			if( outLink ) outLink.send(<Message>message[1]);
		}
	}
	
	protected receivePacket(linkPath:string, packet:Message) {
		this.updateDevice( (device, busMessageQueue) => {
			return this.simulator.packetReceived(device, linkPath, packet, busMessageQueue);
		});
	}
	
	protected updateTimerId:NodeJS.Timer;
	protected updateTimerTime:number = Infinity;
	protected fixUpdateTimer(currentTime:number) {
		let nextAutoUpdateTime = this.simulator.getNextAutoUpdateTime(this.device);
		if( nextAutoUpdateTime != this.updateTimerTime ) {
			if( this.updateTimerId != undefined ) clearTimeout(this.updateTimerId);
			if( nextAutoUpdateTime < Infinity ) {
				this.updateTimerId = setTimeout( () => {
					this.updateDevice( (device,busMessageQueue) => device );
				}, Math.max(0, nextAutoUpdateTime-currentTime)*1000 );
			}
		}
		// Need to call update in a loop or something
	}
	
	public start() {
		this.fixUpdateTimer(Date.now()/1000);
	}
	
	protected updateDevice( updater:(device:Device, busMessageQueue:EntitySystemBusMessage[])=>Device ) {
		const currentTime = Date.now()/1000;
		const busMessageQueue = [];
		this.device = this.simulator.update(this.device, currentTime, this.busMessageQueue );
		this.device = updater(this.device, this.busMessageQueue);
		this.processQueuedMessages();
		this.fixUpdateTimer(currentTime);
	}
	
	addLink( link:MessageLink<Message>, _linkPath?:string ) {
		const linkPath = _linkPath || "/links/"+(this.nextLinkId++);
		link.setUp( (message) => this.receivePacket(linkPath, message) );
		this.links[linkPath] = link;
		this.updateDevice( (device, busMessageQueue) => {
			return this.simulator.linkAdded(device, linkPath, {}, busMessageQueue);
		});
		return linkPath;
	}
	
	removeLink( linkPath:string ) {
		const link = this.links[linkPath];
		if( link == null ) return;
		link.setDown();
		delete this.links[linkPath];
		this.updateDevice( (device, busMessageQueue) => {
			return this.simulator.linkRemoved(device, linkPath, busMessageQueue);
		});
	}
}
