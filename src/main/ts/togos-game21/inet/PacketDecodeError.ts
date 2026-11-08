export default class PacketDecodeError extends Error {
	constructor(public override message:string) {
		super(message);
	}
}
