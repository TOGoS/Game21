import KeyedList from '../KeyedList';

export function getQueryStringValues(qs:string = window.location.search.substr(1)):KeyedList<string> {
	const qsParts = qs.split('&');
	const vals:KeyedList<string> = {};
	for( let p in qsParts ) {
		const q = qsParts[p];
		if( q == '' ) continue;
		const kv = q.split('=',2);
		if( kv.length == 1 ) {
			vals[kv[0]] = kv[0];
		} else {
			vals[kv[0]] = kv[1];
		}
	}
	return vals;
}
