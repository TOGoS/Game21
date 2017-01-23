import {deepFreeze} from '../DeepFreezer';
import DuplicatePacketTable, {packetId, checkPacket, makeDuplicatePacketTable} from './DuplicatePacketTable';

const packetA = new Uint8Array([1,2,3,4,5]);
const packetB = new Uint8Array([1,2,3,4,5,6]);
if( packetId(packetA) == packetId(packetB) ) {
	throw new Error("Our test case isn't too great; CRCs of packets match ;(");
}

function assertTableNotUpdated(tableB:any, tableBName:string) {
	if( tableB != null ) throw new Error("Expected checkPacket to return null, but something else was returned for "+tableBName);
}

function assertTableUpdated(tableA:any, tableB:any, tableBName:string) {
	if( tableB == null ) throw new Error("Expected checkPacket to return a new table, but null was returned for "+tableBName);
	if( tableB === tableA ) throw new Error("Expected checkPacket to return a new table, but it returned the same old table for "+tableBName);
}

function checkPacketExpectingNewTable(packet:Uint8Array, time:number, table:DuplicatePacketTable, newTableName:string):DuplicatePacketTable {
	const newTab = checkPacket(packet, time, table);
	assertTableUpdated(table, newTab, newTableName);
	return deepFreeze(newTab);
}

function checkPacketExpectingNull(packet:Uint8Array, time:number, table:DuplicatePacketTable, newTableName:string):void {
	const newTab = checkPacket(packet, time, table);
	assertTableNotUpdated(newTab, newTableName);
}

const table0 = deepFreeze(makeDuplicatePacketTable());
const table1 = checkPacketExpectingNewTable(packetA, 100, table0, 'table0');
               checkPacketExpectingNull(packetA, 100, table1, 'table1b');
					checkPacketExpectingNull(packetA, 100.5, table1, 'table1b');
					checkPacketExpectingNull(packetA,  99.5, table1, 'table1b');
const table2 = checkPacketExpectingNewTable(packetA, 102, table1, 'table2');
               checkPacketExpectingNull(packetA, 100, table2, 'table2b');
const table3 = checkPacketExpectingNewTable(packetB, 102, table2, 'table3');
               checkPacketExpectingNull(packetB, 102, table3, 'table3b');
