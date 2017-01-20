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
 *   Simulator (defines behavior, response to events)
 *   State (actual data)
 */
class NetworkDeviceShell<Device,Message> {
	protected links:KeyedList<MessageLink<Message>> = {};
	protected nextLinkId = 1;
	protected busMessageQueue:EntitySystemBusMessage[] = [];
	
	public constructor(
		protected simulator : NetworkDeviceSimulator<Device,Message>,
		protected device : Device
	) {
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
		this.device = this.simulator.packetReceived(this.device, linkPath, packet, this.busMessageQueue);
		this.processQueuedMessages();
	}
	
	protected update(time:number) {
		this.device = this.simulator.update(this.device, time, this.busMessageQueue);
	}
	
	addLink( link:MessageLink<Message>, linkPath?:string ) {
		if( !linkPath ) linkPath = "/link"+(this.nextLinkId++);
		this.device = this.simulator.linkAdded(this.device, linkPath, this.busMessageQueue);
		link.setUp( (message) => this.receivePacket(linkPath, message) );
		this.links[linkPath] = link;
		this.processQueuedMessages();
		return linkPath;
	}
	
	removeLink( linkPath:string ) {
		const link = this.links[linkPath];
		if( link == null ) return;
		this.device = this.simulator.linkRemoved(
			this.device, linkPath, this.busMessageQueue);
		link.setDown();
		delete this.links[linkPath];
		this.processQueuedMessages();
	}
}
