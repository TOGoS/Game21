/// <reference path="../../Promise.d.ts" />

import KeyedList from '../KeyedList';
import {
	Word, WordType, RuntimeWord, CompilationWord, RuntimeContext, CompilationContext, Program, WordGetter
} from './rs1';

export const arithmeticWords : KeyedList<Word> = {
	"+": <RuntimeWord>{
		name: "+",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			const b = ctx.dataStack.pop();
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(a + b);
		}
	},
	"-": <RuntimeWord>{
		name: "-",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			const b = ctx.dataStack.pop();
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(a - b);
		}
	},
	"*": <RuntimeWord>{
		name: "*",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			const b = ctx.dataStack.pop();
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(a * b);
		}
	},
	"/": <RuntimeWord>{
		name: "/",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			const b = ctx.dataStack.pop();
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(a / b);
		}
	},
}

export const stackWords:KeyedList<Word> = {
	"dup": <RuntimeWord>{
		name: "dup",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(a);
			ctx.dataStack.push(a);
		}
	},
	"drop": <RuntimeWord>{
		name: "drop",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			ctx.dataStack.pop();
		}
	},
	"swap": <RuntimeWord>{
		name: "swap",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			const b = ctx.dataStack.pop();
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(b);
			ctx.dataStack.push(a);
		}
	},
}

export const jumpWords:KeyedList<Word> = {
	"goto": <RuntimeWord>{
		name: "goto",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			ctx.ip = ctx.dataStack.pop();
		}
	},
}

export const rsWords:KeyedList<Word> = {
	"call": <RuntimeWord>{
		name: "call",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			ctx.returnStack.push(ctx.ip);
			ctx.ip = ctx.dataStack.pop();
		}
	},
	"exit": <RuntimeWord>{
		name: "exit",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			ctx.ip = ctx.returnStack.pop();
		}
	},
	">r": <RuntimeWord>{
		name: "push-to-return-stack",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			ctx.returnStack.push(ctx.dataStack.pop());
		}
	},
	"r>": <RuntimeWord>{
		name: "pop-from-return-stack",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			ctx.dataStack.push(ctx.returnStack.pop());
		}
	},
};

export function makeWordGetter( words:KeyedList<Word>, ...backups : WordGetter[] ) : WordGetter {
	return (text:string) => {
		if( words[text] ) return words[text];
		for( let b in backups ) {
			let w = backups[b](text);
			if( w != null ) return w;
		}
		return null;
	}
}

export function mergeDicts<T>(...dicts:KeyedList<T>[]):KeyedList<T> {
	const z:KeyedList<T> = {};
	for( let i in dicts ) {
		for( let k in dicts[i] ) {
			z[k] = dicts[i][k];
		}
	}
	return z;
}

export function literalValueWord( v:any ) : RuntimeWord {
	return {
		name: ""+v,
		wordType: WordType.PUSH_VALUE,
		value: v,
		forthRun: function(ctx:RuntimeContext) {
			ctx.dataStack.push(this.value);
			return Promise.resolve(ctx)
		}
	};
}

export function parseNumberWord( text:string ) : RuntimeWord {
	if( /^[+-]?\d+$/.test(text) ) {
		return literalValueWord( +text );
	}
	return null;
}

export const standardWords = mergeDicts(arithmeticWords, stackWords, jumpWords, rsWords);
