window.WebSocketDemo = (function() {
"use strict";

var WebSocketDemo = function() {
	this.connection = null;
	this.packetEncodingMode = "JSON";
	this.enqueuedMessages = [];
	// placeholders!
	this.sourceAddress = "fe80::1";
	this.peerAddress = "fe80::2";
	this.nextPingSequenceNumber = 0;
}
WebSocketDemo.prototype.connectIfNotConnected = function(wsUrl) {
	if( this.connection == null ) {
		this.connection = new WebSocket(wsUrl);
		this.connection.binaryType = 'arraybuffer';
		this.connection.onopen = this.onOpen.bind(this);
		this.connection.onerror = function(error) {
			console.log("Websocket Error: "+error);
		};
		this.connection.onmessage = this.onMessage.bind(this);
		console.log("Connecting...");
	}
	return this;
}
WebSocketDemo.prototype.onOpen = function() {
	console.log('Connected! '+this.enqueuedMessages.length+" messages enqueued.");
	for( var i=0; i < this.enqueuedMessages.length; ++i ) {
		this.connection.send(this.enqueuedMessages[i]);
	}
};
WebSocketDemo.prototype.onMessage = function(messageEvent) {
	var encoding;
	var data = messageEvent.data;
	if( typeof data == 'string' ) {
		encoding = "JSON";
	} else if( data instanceof ArrayBuffer ) {
		encoding = "binary";
	} else {
		encoding = "???";
	}
	console.log("Received "+encoding+"-encoded message: "+data);
};
WebSocketDemo.prototype.enqueueMessage = function(data) {
	if( this.connection != null && this.connection.readyState == 1 ) {
		this.connection.send(data);
	} else {
		this.enqueuedMessages.push(data);
	}
};
WebSocketDemo.prototype.enqueuePacket = function(packet) {
	if( this.packetEncodingMode == "JSON" ) {
		this.enqueueMessage(JSON.stringify(packet));
	} else {
		throw new Error("Unsupported packet encoding: "+this.packetEncodingMode);
	}
}
WebSocketDemo.prototype.ping = function(peerAddress) {
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

return WebSocketDemo;

})();
