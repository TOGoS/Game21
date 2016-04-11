import IP6Address, {parseIp6Address, stringifyIp6Address} from './IP6Address';

function assertEquals( expected, actual ) {
	if( expected !== actual ) throw new Error("Assertion failed; "+expected+" != "+actual);
}

{
	const addr = parseIp6Address('fe80::1');
	assertEquals(16, addr.length);
	assertEquals(0xfe, addr[0]);
	assertEquals(0x80, addr[1]);
	assertEquals(0x00, addr[2]);
	assertEquals(0x01, addr[15]);
}

{
	const addr = parseIp6Address('fe80:1:2:3:4878:f:527:2');
	assertEquals(16, addr.length);
	assertEquals(0xfe, addr[0]);
	assertEquals(0x80, addr[1]);
	assertEquals(0x00, addr[2]);
	assertEquals(0x01, addr[3]);
	// etc etc
	assertEquals(0x05, addr[12]);
	assertEquals(0x27, addr[13]);
	assertEquals(0x00, addr[14]);
	assertEquals(0x02, addr[15]);
}

//// Make sure canonicalization works

{
	const addr = parseIp6Address('fe80:0:0:0:0:0:0:2');
	assertEquals('fe80::2', stringifyIp6Address(addr));
}

{
	const addr = parseIp6Address('fe80:0:0:1:0:0:0:2');
	assertEquals('fe80:0:0:1::2', stringifyIp6Address(addr));
}

{
	const addr = parseIp6Address('::');
	assertEquals('::', stringifyIp6Address(addr));
}

{
	const addr = parseIp6Address('fe80::0:0:0:0');
	assertEquals('fe80::', stringifyIp6Address(addr));
}

{
	const addr = parseIp6Address('0:0:0::1');
	assertEquals('::1', stringifyIp6Address(addr));
}

{
	const addr = parseIp6Address('1::2');
	assertEquals('1:0:0:0:0:0:0:2', stringifyIp6Address(addr, false));
}
