export function coalesce2<T>(v:T|undefined|null, v1:T):T {
	if( v != null ) return v;
	return v1;
}

export function compareByteArrays( a:Uint8Array, b:Uint8Array ):number {
	const minLen = Math.min(a.length, b.length);
	for( let i = 0; i < minLen; ++i ) {
		const av = a[i];
		const bv = b[i];
		if( av < bv ) return -1;
		if( av > bv ) return +1;
	}
	if( a.length < b.length ) return -1;
	if( a.length > b.length ) return +1;
	return 0;
}

export function toNodeBuffer( a:Buffer|Uint8Array ):Buffer {
	if( a instanceof Buffer ) return a;
	if( Buffer.from ) try {
		return Buffer.from(a.buffer, a.byteOffset, a.byteLength);
	} catch( err ) {
		// For mysterious reasons, that will sometimes result in
		// TypeError: 0 is not a function.
		// In which case we'll continue on and make one by copying.
	}
	const buf = new Buffer(a.byteLength);
	for( let i=0; i<a.length; ++i ) {
		buf[i] = a[i];
	}
	return buf;
}
