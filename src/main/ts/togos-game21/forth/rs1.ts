// Runtime System 1

import KeyedList from '../KeyedList';

export enum WordType {
	PUSH_VALUE,
	PUSH_URI_REF,
	OTHER_COMPILETIME,
	OTHER_RUNTIME
}

export interface Word {
	name : string,
	wordType : WordType,
}

export interface CompilationWord extends Word {
	forthCompile( ctx:CompilationContext ) : Promise<CompilationContext>;
}

export interface RuntimeWord extends Word {
	/** When this is a 'push literal value' word. */
	value? : any;
	valueUri? : string;
	forthRun( ctx:RuntimeContext ) : Promise<RuntimeContext>;
}

type FixupCallback<T> = (value:T, error:string)=>void;
interface Fixup<T> {
	value : T;
	references : FixupCallback<T>[];
}

export interface CompilationContext {
	program : Program;
	fixups : KeyedList<Fixup<number>>
}

export interface RuntimeContext {
	dataStack : any[];
	output : string[];
	
	fuel : number;
	program : Program;
	ip : number;
}

export type Program = RuntimeWord[];
