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
