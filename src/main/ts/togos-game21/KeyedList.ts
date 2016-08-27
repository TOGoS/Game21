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
