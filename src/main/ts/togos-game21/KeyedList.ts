/**
 * Treat it as a list of items with
 * arbitrary string keys
 */
type KeyedList<T> = {[k: string]: T};

export default KeyedList;

export function keyedListIsEmpty<T>(kl:KeyedList<T>):boolean {
	for( let k in kl ) return false;
	return true;
}

export function elementCount(t:KeyedList<any>):number {
	let i = 0;
	for( let k in t ) ++i;
	return i;
}