#!/usr/bin/env node

var IP6Address = require('./IP6Address');

/*
 * Routes packets between
 * - WebSocket-connected clients
 * - The Internet (via TUN)
 * - Any attached FIFOs
 * 
 * In-game routing is done in-game; packets between rooms are wrapped
 * in simulated 'data packet' messages sent between room servers.
 * 
 * However, there are uplinks in the game that connect the in-game network
 * with our simulated little branch of the internet.
 * 
 * There are several layers of routing:
 * 
 * Internet /0
 *   NetRouter server (one of these) /48
 *     Browser or simulation process /56
 *       RoomGroupServer /60
 *         RoomGroupSimulator /128
 *         Uplink w/ in-game router /64
 *           - messages here are actually wrapped handled by the room group simulator as 'uplink received this message'
 *           In-game routers /?
 *             In-game objects that aren't themselves routers /128
 * 
 * This program is only concerned with the 'NetRouter server' layer.
 */

/** @interface */
var Connection = function() { };
var WrappingConnection = function() {
};

/**
 * @param {Uint8Array} addr - IPv6 address bytes
 * @param {integer} prefixLen - number of leading bits in the address that must be matched
 * @param {string} connectionKey - index into connections map indicating which one these should be routed to
 */
var Route = function(addr, prefixLen, connectionKey) {
};

var Router = function() {
	this.connections = {};
};



var PacketInfo = function(packet, cloneFrom) {
	this.packet = packet; // A Uint8Array of the actual packet, or null if not yet generated
	// UDP is assumed for now
	if( cloneFrom ) {
		this.sourceAddress = cloneFrom.sourceAddress;
		this.sourcePort    = cloneFrom.sourcePort;
		this.destAddress   = cloneFrom.destAddress;
		this.destPort      = cloneFrom.destPort;
		this.payload       = cloneFrom.payload;
		this.payloadObject = cloneFrom.payloadObject;
	} else {
		this.sourceAddress = null;
		this.sourcePort    = null;
		this.destAddress   = null;
		this.destPort      = null;
		this.payload       = null;
		this.payloadObject = null;
	}
};
PacketInfo.fromJson = function(json) {
	var props = JSON.parse(json);
	var pi = new PacketInfo();
	pi.sourc
};

Router.prototype.handlePacket = function(packet, received, packetInfo) {
	if( packetInfo === undefined ) {
		throw new Error("Packet parsing not yet implemented; pass that in");
	}
};

var parsedAddr = IP6Address.parse('fe80::21b:78ff:fe50:a91');
var reencodedAddr = IP6Address.stringify(parsedAddr);
console.log(reencodedAddr);
