import PacketDecodeError from './PacketDecodeError';

type IPPayload = Uint8Array;

export interface IPMessage {
	ipVersion : number;
	sourceAddress : Uint8Array;
	destAddress : Uint8Array;
	// For IP4 packets, hopLimit should be emulated based on ttl
	// (not sure if identical or not; some webpages suggest they are different by 1)
	hopLimit : number;
	// protocolNumber is the same as IP6's 'next header';
	// it indicates the meaning and format of the payload
	protocolNumber : number;
	payload : IPPayload;
}

export interface IP6Message extends IPMessage {
	trafficClass : number;
	flowLabel : number;
}

function disassembleIp4Packet( packet:Uint8Array ):IPMessage {
	throw new PacketDecodeError("IP4 packet disassembly currently unsupported");
}

function disassembleIp6Packet( packet:Uint8Array ):IP6Message {
	if( packet.byteLength < 40 ) throw new PacketDecodeError("IP6 packet is impossibly short ("+packet.byteLength+" bytes)");
	
	const dv = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);

	const trafficClass = (dv.getUint16(0) >> 4) & 0xFF;
	const flowLabel = dv.getUint32(0) & 0x00FFFFF;
	const payloadLength = dv.getUint16(4);
	const nextHeader = dv.getUint8(6);
	const hopLimit = dv.getUint8(7);
	
	if( payloadLength + 40 > packet.byteLength ) {
		throw new PacketDecodeError(
			"IP6 packet payload (length = "+payloadLength+
			") extends past end of packet (length = "+packet.byteLength+")"
		);
	}
	
	return {
		ipVersion: 6,
		trafficClass:  trafficClass,
		flowLabel:     flowLabel,
		protocolNumber:nextHeader,
		hopLimit:      hopLimit,
		sourceAddress: new Uint8Array(packet.buffer, packet.byteOffset +  8, 16),
		destAddress:   new Uint8Array(packet.buffer, packet.byteOffset + 24, 16),
		payload:       new Uint8Array(packet.buffer, packet.byteOffset + 40, payloadLength),
	}
}

export function disassembleIpPacket( packet:Uint8Array ):IPMessage {
	const version = (packet[0] >> 4);
	switch( version ) {
	case 4: return disassembleIp4Packet(packet);
	case 6: return disassembleIp6Packet(packet);
	default:
		throw new PacketDecodeError("Unknown IP packet version: "+version);
	}
}

function assembleIp4Packet( info:IPMessage ):Uint8Array {
	throw new Error("IP4 packet assembly not yet supported");
}

function assembleIp6Packet( info:IP6Message ):Uint8Array {
	const packet = new Uint8Array(40 + info.payload.byteLength);
	
	const dv = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
	dv.setUint32(0,
		(info.ipVersion << 28) |
		(info.trafficClass << 20) |
		(info.flowLabel)
	);
	dv.setUint32(4,
		(info.payload.byteLength << 16) |
		(info.protocolNumber << 8) |
		(info.hopLimit)
	);
	
	packet.set( info.sourceAddress, 8 );
	packet.set( info.destAddress, 24 );
	packet.set( new Uint8Array(info.payload.buffer), 40 );
	return packet;
}

export function assembleIpPacket( info:IPMessage ):Uint8Array {
	switch( info.ipVersion ) {
	case 4: return assembleIp4Packet(info);
	case 6: return assembleIp6Packet(<IP6Message>info);
	default:
		throw new Error("Unknown IP packet version: "+info.ipVersion);
	}
}
