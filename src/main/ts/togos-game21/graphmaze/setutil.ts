import KeyedList from '../KeyedList';

export function union<T>( a:KeyedList<T>, b:KeyedList<T> ):KeyedList<T> {
	let aIsComplete:boolean = true;
	let bIsComplete:boolean = true;
	for( let k in a ) if( !b[k] ) bIsComplete = false;
	if( bIsComplete ) return b;
	for( let k in b ) if( !a[k] ) aIsComplete = false;
	if( aIsComplete ) return a;
	const union:KeyedList<T> = {};
	for( let k in a ) union[k] = a[k];
	for( let k in b ) union[k] = b[k];
	return union;
}

export function isSubset<T>( a:KeyedList<T>, b:KeyedList<T> ):boolean {
	for( let k in a ) if( !b[k] ) return false;
	return true;
}

export function isSameSet<T>( a:KeyedList<T>, b:KeyedList<T> ):boolean {
	return isSubset(a,b) && isSubset(b,a);
}

export function difference<T>( a:KeyedList<T>, b:KeyedList<T> ):KeyedList<T> {
	const diff:KeyedList<T> = {};
	for( let k in a ) if( !b[k] ) diff[k] = a[k];
	return diff;
}

export function symmetricDifference<T>( a:KeyedList<T>, b:KeyedList<T> ):KeyedList<T> {
	const diff:KeyedList<T> = {};
	for( let k in a ) if( !b[k] ) diff[k] = a[k];
	for( let k in b ) if( !a[k] ) diff[k] = b[k];
	return diff;
}

export function isEmpty<T>(t:KeyedList<T>):boolean {
	for( let i in t ) return false;
	return true;
}
