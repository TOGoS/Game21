export type MessageHandler<T> = (packet:T)=>void;

/**
 * Sends and receives datagrams.
 */
interface MessageLink<T> {
	state:"up"|"down";
	/**
	 * Incoming packets should be passed to handler.
	 * This can be expected to be called only once.
	 * Some protocols may pass SomeType|undefined,
	 * where undefined means end of stream.
	 **/
	setUp(handler:MessageHandler<T>):void;
	/**
	 * Don't deliver any more packets.
	 **/
	setDown():void;
	/**
	 * Send an outgoing packet.
	 * If state is "down" this may drop the packet.
	 * */
	send(packet:T):void;
}

export default MessageLink;
