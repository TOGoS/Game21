import WebSocketLike from './WebSocketLike';

declare class WebSocket implements WebSocketLike {
	constructor(wsUrl:string);
	readyState : number;
	binaryType : string;
	send(data:string|ArrayBuffer);
	onopen : (event:any)=>void;
	onerror : (event:any)=>void;
	onclose : (event:any)=>void;
	onmessage : (event:any)=>void;
};

export default class WebSocketClient {
	public connection:WebSocket;
	public packetEncodingMode:string;
	public enqueuedMessages:any[];
	public localAddress:string;
	public peerAddress:string;
	public nextPingSequenceNumber:number=0;
	public console;
	
	constructor() {
		this.connection = null;
		this.packetEncodingMode = "JSON";
		this.enqueuedMessages = [];
		// placeholders!
		this.localAddress = "fe80::1";
		this.peerAddress = "fe80::2";
		this.console = window.console;
	}
	public connectIfNotConnected(wsUrl) {
		if( this.connection == null ) {
			this.connection = new WebSocket(wsUrl);
			this.connection.binaryType = 'arraybuffer';
			this.connection.onopen = this.onOpen.bind(this);
			this.connection.onerror = error => {
				this.console.log("Websocket Error: ", error);
			};
			this.connection.onmessage = this.onMessage.bind(this);
			this.console.log("Connecting...");
		}
		return this;
	}
	protected onOpen() {
		this.console.log('Connected! '+this.enqueuedMessages.length+" messages enqueued.");
		for( var i=0; i < this.enqueuedMessages.length; ++i ) {
			this.connection.send(this.enqueuedMessages[i]);
		}
	};
	protected onMessage(messageEvent) {
		var encoding;
		var data = messageEvent.data;
		if( typeof data == 'string' ) {
			encoding = "JSON";
		} else if( data instanceof ArrayBuffer ) {
			encoding = "binary";
		} else {
			encoding = "???";
		}
		this.console.log("Received "+encoding+"-encoded message: "+data);
	};
	protected enqueueMessage(data) {
		if( this.connection != null && this.connection.readyState == 1 ) {
			this.connection.send(data);
		} else {
			this.enqueuedMessages.push(data);
		}
	};
	protected enqueuePacket(packet) {
		if( this.packetEncodingMode == "JSON" ) {
			this.enqueueMessage(JSON.stringify(packet));
		} else {
			throw new Error("Unsupported packet encoding: "+this.packetEncodingMode);
		}
	}
	protected ping(peerAddress) {
		if( peerAddress == null ) peerAddress = this.peerAddress;
		
		this.enqueuePacket({
			protocolName: "IPv6",
			sourceAddress: this.localAddress, destAddress: peerAddress,
			subProtocolName: "ICMPv6", payloadObject: {
				type: 128,
				code: 0,
				payloadObject: {
					identifier: 1234,
					squenceNumber: this.nextPingSequenceNumber++,
					payload: "Hello, world!"
				}
			}
		});
	}
}
