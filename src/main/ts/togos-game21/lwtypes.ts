/* Lightweight types */

export type SoftRef = string;
export type HardRef = string;
export type Ref = string;
export type LWMap<K extends string,V> = {[k:string]: V};
export type LWSet<T extends string> = LWMap<T,boolean>; // Or could use booleans like the graphmaze/setutil
