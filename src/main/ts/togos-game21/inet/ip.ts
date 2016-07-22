import PacketDecodeError from './PacketDecodeError';

export interface IPPacketInfo {
	ipVersion : number;
	sourceAddress : Uint8Array;
	destAddress : Uint8Array;
	// For IP4 packets, hopLimit should be emulated based on ttl
	// (not sure if identical or not; some webpages suggest they are different by 1)
	hopLimit : number;
	// protocolNumber is the same as IP6's 'next header';
	// it indicates the meaning and format of the payload
	protocolNumber : number;
	payload : DataView;
}

export interface IP6PacketInfo extends IPPacketInfo {
	trafficClass : number;
	flowLabel : number;
}

function disassembleIp4Packet( packet:DataView ):IPPacketInfo {
	throw new Error("IP4 packet disassembly currently unsupported");
}

function disassembleIp6Packet( packet:DataView ):IP6PacketInfo {
	if( packet.byteLength < 40 ) throw new PacketDecodeError("IP6 packet is impossibly short ("+packet.byteLength+" bytes)");
	
	const trafficClass = (packet.getUint16(0) >> 4) & 0xFF;
	const flowLabel = packet.getUint32(0) & 0x00FFFFF;
	const payloadLength = packet.getUint16(4);
	const nextHeader = packet.getUint8(6);
	const hopLimit = packet.getUint8(7);
	
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
		payload:       new DataView(packet.buffer, packet.byteOffset + 40, payloadLength),
	}
}

export function disassembleIpPacket( packet:DataView ):IPPacketInfo {
	const version = (packet.getUint8(0) >> 4);
	switch( version ) {
	case 4: return disassembleIp4Packet(packet);
	case 6: return disassembleIp6Packet(packet);
	default:
		throw new PacketDecodeError("Unknown IP packet version: "+version);
	}
}

function assembleIp4Packet( info:IPPacketInfo ):DataView {
	throw new Error("IP4 packet assembly not yet supported");
}

function assembleIp6Packet( info:IP6PacketInfo ):DataView {
	const packet = new DataView(new ArrayBuffer(40 + info.payload.byteLength));
	packet.setUint32(0,
		(info.ipVersion << 28) |
		(info.trafficClass << 20) |
		(info.flowLabel)
	);
	packet.setUint32(4,
		(info.payload.byteLength << 16) |
		(info.protocolNumber << 8) |
		(info.hopLimit)
	);

	// Someone on StackOverflow said this was the fastest way to copy data
	// (http://stackoverflow.com/questions/10100798)
	const u8a = new Uint8Array(packet.buffer, packet.byteOffset);
	u8a.set( info.sourceAddress, 8 );
	u8a.set( info.destAddress, 24 );
	u8a.set( new Uint8Array(info.payload.buffer), 40 );
	return packet;
}

export function assembleIpPacket( info:IPPacketInfo ):DataView {
	switch( info.ipVersion ) {
	case 4: return assembleIp4Packet(info);
	case 6: return assembleIp6Packet(<IP6PacketInfo>info);
	default:
		throw new Error("Unknown IP packet version: "+info.ipVersion);
	}
}

// TODO: Move this to some utilities file

import { utf8Encode } from '../../tshash/utils';

export function toDataView( data:(string|DataView|Uint8Array) ):DataView {
	if( typeof(data) === 'string' ) data = utf8Encode(<string>data);
	if( data instanceof DataView ) return <DataView>data;
	if( data instanceof Uint8Array ) return new DataView(
		(<Uint8Array>data).buffer, (<Uint8Array>data).byteOffset, (<Uint8Array>data).byteLength);
	throw new Error("Don't know how to convert this thing to a DataView");
}
