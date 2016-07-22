export default class PacketDecodeError extends Error {
	constructor(public message:string) {
		super(message);
	}
}
