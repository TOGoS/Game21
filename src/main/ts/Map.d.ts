declare class Map<K,V> {
	get(k:K):V|undefined;
	has(k:K):boolean;
	set(k:K, v:V):Map<K,V>;
}

declare class WeakMap<K,V> {
	get(k:K):V|undefined;
	has(k:K):boolean;
	set(k:K, v:V):Map<K,V>;
}
