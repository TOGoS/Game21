import MACAddressMap, * as mam from './MACAddressMap';
import {assertEquals} from '../testing';

const map = mam.createTable<string>({maxTableSize: 2});

const something = new Uint8Array([1,2,3,4,5,6,7,8,9,10,11,12]);

mam.addEntry(map, something, 0, "Hi");
assertEquals(1, map.tableSize, "1 entry added");
assertEquals("Hi", mam.getEntry(map, something, 0));
assertEquals(undefined, mam.getEntry(map, something, 1));
assertEquals(undefined, mam.getEntry(map, something, 6));

mam.addEntry(map, something, 6, "Hits");
assertEquals(2, map.tableSize, "2 entries added");
assertEquals("Hits", mam.getEntry(map, something, 6));

mam.addEntry(map, something, 1, "Bits");
assertEquals("Bits", mam.getEntry(map, something, 1));
// Table should have been rotated, so back to size=1
assertEquals(1, map.tableSize, "3 entries added");
mam.addEntry(map, something, 2, "Wits");
assertEquals("Wits", mam.getEntry(map, something, 2));
assertEquals(2, map.tableSize, "4 entries added");

