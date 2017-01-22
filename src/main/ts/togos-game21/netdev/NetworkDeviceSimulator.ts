import EntitySystemBusMessage from '../EntitySystemBusMessage';

/**
 * Defines simulation implementation for a class of devices.
 * This is meant to allow stand-alone simulation of devices,
 * as well as implement subsystem updates (the device being a subsystem)
 * for maze simulation.
 * 
 * Device can send outgoing messages by
 * adding them to the bus message queue with linkPath of the outgoing link.
 * Some devices may have a built-in set of links; for these, addLink will be ignored.
 * update(device, time) will be called before every externally-induced event.
 * It will also be called at the time returned by getNextAutoUpdateTime.
 * 
 * You may store time of the last update in the simulator
 * and reference it instead of storing it on the device,
 * since events will always be processed after update is called.
 */
interface NetworkDeviceSimulator<Device,Packet> {
	createDevice(options:{[k:string]: any}):Device;
	linkAdded(device:Device, linkPath:string, linkOptions:{[k:string]:any}, busMessageQueue:EntitySystemBusMessage[]):Device;
	linkRemoved(device:Device, linkPath:string, busMessageQueue:EntitySystemBusMessage[]):Device;
	packetReceived(device:Device, linkPath:string, packet:Packet, busMessageQueue:EntitySystemBusMessage[]):Device;
	update(device:Device, time:number, busMessageQueue:EntitySystemBusMessage[]):Device;
	getNextAutoUpdateTime(device:Device):number;
}

export default NetworkDeviceSimulator;
