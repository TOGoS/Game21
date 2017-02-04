import EntitySystemBusMessage from '../EntitySystemBusMessage';

interface BusMessagableDeviceSimulator<Device> {
	busMessageReceived(message:EntitySystemBusMessage, busMessageQueue:EntitySystemBusMessage[]):Device;
}

export default BusMessagableDeviceSimulator;
