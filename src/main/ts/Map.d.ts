declare class Map<K,V> {
	clear(): void;
	delete(key: K): boolean;
	forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void;
	get(key: K): V | undefined;
	has(key: K): boolean;
	set(key: K, value?: V): this;
	readonly size: number;
}

declare class WeakMap<K,V> {
	get(k:K):V|undefined;
	has(k:K):boolean;
	set(k:K, v:V):Map<K,V>;
}
