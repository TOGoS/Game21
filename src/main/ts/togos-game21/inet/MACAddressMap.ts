import {thaw} from '../DeepFreezer';

/**
 * 2-generation map for caching information
 * keyed by 48-bit MAC addresses
 */
interface MACAddressMap<T> {
	maxTableSize : number;
	table1 : T[][]; // Older generation of macAddressLinks
	table : T[][]; // Keyed by top and bottom 24 bits of mac address
	tableSize : number;
}
export default MACAddressMap;

export function createTable<T>(opts:{maxTableSize?:number}={}):MACAddressMap<T> {
	return {
		maxTableSize: opts.maxTableSize || 128,
		table1: [],
		table: [],
		tableSize: 0,
	}
}

function ngHasEntry<T>(table:MACAddressMap<T>, key:Uint8Array, keyOffset:number ):boolean {
	const upperKey = (
		(key[keyOffset+0] << 16) |
		(key[keyOffset+1] <<  8) |
		(key[keyOffset+2] <<  0)
	);
	
	const subTable = table.table[upperKey];
	if( subTable == undefined ) return false;
	
	const lowerKey = (
		(key[keyOffset+3] << 16) |
		(key[keyOffset+4] <<  8) |
		(key[keyOffset+5] <<  0)
	);
	
	return subTable[lowerKey] != undefined;
}

export function addEntry<T>(table:MACAddressMap<T>, key:Uint8Array, keyOffset:number, value:T ):MACAddressMap<T> {
	const upperKey = (
		(key[keyOffset+0] << 16) |
		(key[keyOffset+1] <<  8) |
		(key[keyOffset+2] <<  0)
	);
	const lowerKey = (
		(key[keyOffset+3] << 16) |
		(key[keyOffset+4] <<  8) |
		(key[keyOffset+5] <<  0)
	);
	
	let subTable = table.table[upperKey];
	if( subTable != undefined && subTable[lowerKey] === value ) {
		return table;
	}
	
	if( table.tableSize >= table.maxTableSize ) {
		table = thaw(table);
		table.table1 = table.table;
		subTable = [];
		subTable[lowerKey] = value;
		table.table = [];
		table.table[upperKey] = subTable;
		table.tableSize = 1;
		return table;
	}
	
	table = thaw(table);
	table.table = thaw(table.table);
	subTable = table.table[upperKey];
	if( subTable == undefined ) {
		subTable = [];
		subTable[lowerKey] = value;		
		++table.tableSize;
		table.table[upperKey] = subTable;
		return table;
	}
	
	table.table[upperKey] = subTable = thaw(subTable);
	subTable[lowerKey] = value;
	++table.tableSize;
	return table;
}

export function getEntry<T>(table:MACAddressMap<T>, key:Uint8Array, keyOffset:number ):T|undefined {
	const upperKey = (
		(key[keyOffset+0] << 16) |
		(key[keyOffset+1] <<  8) |
		(key[keyOffset+2] <<  0)
	);
	const lowerKey = (
		(key[keyOffset+3] << 16) |
		(key[keyOffset+4] <<  8) |
		(key[keyOffset+5] <<  0)
	);
	
	const subTable = table.table[upperKey];
	const subTable1 = table.table1[upperKey];
	
	return (subTable && subTable[lowerKey]) || (subTable1 && subTable1[lowerKey]);
}
