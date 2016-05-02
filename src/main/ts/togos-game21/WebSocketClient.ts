import WebSocketLike from './WebSocketLike';

interface ConsoleLike {
	log(...stuff:string[]):void;
}

declare class WebSocket implements WebSocketLike {
	constructor(wsUrl:string);
	readyState : number;
	binaryType : string;
	send(data:string|ArrayBuffer):void;
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
	public console:ConsoleLike;
	
	constructor() {
		this.connection = null;
		this.packetEncodingMode = "JSON";
		this.enqueuedMessages = [];
		// placeholders!
		this.localAddress = "fe80::1";
		this.peerAddress = "fe80::2";
		this.console = window.console;
	}
	public connectIfNotConnected(wsUrl:string):WebSocketClient {
		if( this.connection == null ) {
			this.console.log("Attempting to connect to "+wsUrl);
			this.connection = new WebSocket(wsUrl);
			this.connection.binaryType = 'arraybuffer';
			this.connection.onopen = this.onOpen.bind(this);
			this.connection.onerror = (error) => {
				this.connection = null;
				this.console.log("Websocket Error:", error, "; disconnected");
			};
			this.connection.onmessage = this.onMessage.bind(this);
			this.console.log("Connecting...");
		}
		return this;
	}
	protected onOpen() {
		this.console.log('Connected!');
		for( var i=0; i < this.enqueuedMessages.length; ++i ) {
			this.connection.send(this.enqueuedMessages[i]);
		}
		this.console.log("Sent "+this.enqueuedMessages.length+" queued messages.");
	};
	protected checkConnection() {
		if( this.connection && this.connection.readyState > 1 ) {
			// Connection closed!
			this.connection = null;
		}
	};
	protected onMessage(messageEvent:any):void {
		var encoding:string;
		var data = messageEvent.data;
		var logData:any;
		if( typeof data == 'string' ) {
			encoding = "JSON";
			logData = JSON.parse(data);
		} else if( data instanceof ArrayBuffer ) {
			encoding = "binary";
			logData = data;
		} else {
			encoding = "???";
			logData = null;
		}
		this.console.log("Received "+encoding+"-encoded message:", logData);
	};
	protected enqueueMessage(data:any):void {
		this.checkConnection();
		if( this.connection != null && this.connection.readyState == 1 ) {
			this.console.log("Sending message now");
			this.connection.send(data);
		} else {
			this.console.log("Not yet connected; enqueing message.");
			this.enqueuedMessages.push(data);
		}
	};
	protected enqueuePacket(packet:any):void {
		if( this.packetEncodingMode == "JSON" ) {
			this.enqueueMessage(JSON.stringify(packet));
		} else {
			throw new Error("Unsupported packet encoding: "+this.packetEncodingMode);
		}
	}
	protected ping(peerAddress:string) {
		if( peerAddress == null ) peerAddress = this.peerAddress;
		
		this.enqueuePacket({
			ipVersion: 6,
			sourceAddressString: this.localAddress,
			destAddressString: peerAddress,
			subProtocolNumber: 58,
			payloadObject: {
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
