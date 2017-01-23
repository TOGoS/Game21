import {crc32} from 'tshash/CRC32';
import {thaw} from '../DeepFreezer';

export type PacketID = number;

declare function Symbol(name:string):symbol;
const ID_SYMBOL = Symbol("Packet ID");

export function packetId( packet:Uint8Array ):number {
	let id = packet[ID_SYMBOL];
	if( id != undefined ) return id;
	return packet[ID_SYMBOL] = crc32(packet);
}

interface DuplicatePacketTable {
	timeout: number;
	maxTableSize: number;
	packetTimes1: number[];
	packetTimes: number[];
	tableSize: number;
}
export default DuplicatePacketTable;

export function makeDuplicatePacketTable():DuplicatePacketTable {
	return {
		timeout: 1,
		maxTableSize: 128,
		packetTimes1: [],
		packetTimes: [],
		tableSize: 0,
	};
}

export function addEntry( table:DuplicatePacketTable, packetId:PacketID, time:number ):DuplicatePacketTable {
	table = thaw(table);
	if( table.tableSize >= table.maxTableSize ) {
		table.packetTimes1 = table.packetTimes;
		table.packetTimes = [];
		table.tableSize = 0;
	} else {
		table.packetTimes = thaw(table.packetTimes);
	}
	
	table.packetTimes[packetId] = time;
	++table.tableSize;
	return table;
}

/**
 * If the packet is a duplicate, null is returned.
 * If the packet is not a duplicate, an updated version of the table is returned.
 */
export function checkPacket( packet:Uint8Array, time:number, table:DuplicatePacketTable ):DuplicatePacketTable|undefined {
	const id = packetId(packet);
	let previousTime = table.packetTimes[id];
	if( previousTime == undefined ) previousTime = table.packetTimes1[id];
	if( previousTime != undefined && time - previousTime < table.timeout ) return null;
	
	return addEntry(table, id, time);
}
