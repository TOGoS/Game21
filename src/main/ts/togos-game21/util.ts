export function coalesce2<T>(v:T|undefined|null, v1:T):T {
	if( v != null ) return v;
	return v1;
}
