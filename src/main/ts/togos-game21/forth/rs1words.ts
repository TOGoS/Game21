/// <reference path="../../Promise.d.ts" />

import KeyedList from '../KeyedList';
import {
	Word, WordType, RuntimeWord, CompilationWord, RuntimeContext, CompilationContext, Program
} from './rs1';

export const arithmeticWords : KeyedList<Word> = {
	"+": <RuntimeWord>{
		name: "+",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			--ctx.fuel;
			const b = ctx.dataStack.pop();
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(a + b);
			return Promise.resolve(ctx);
		}
	},
	"-": <RuntimeWord>{
		name: "-",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			--ctx.fuel;
			const b = ctx.dataStack.pop();
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(a - b);
			return Promise.resolve(ctx);
		}
	},
	"*": <RuntimeWord>{
		name: "*",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			--ctx.fuel;
			const b = ctx.dataStack.pop();
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(a * b);
			return Promise.resolve(ctx);
		}
	},
	"/": <RuntimeWord>{
		name: "/",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			--ctx.fuel;
			const b = ctx.dataStack.pop();
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(a / b);
			return Promise.resolve(ctx);
		}
	},
}

export const stackWords:KeyedList<Word> = {
	"dup": <RuntimeWord>{
		name: "dup",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			--ctx.fuel;
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(a);
			ctx.dataStack.push(a);
			return Promise.resolve(ctx);
		}
	},
	"drop": <RuntimeWord>{
		name: "drop",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			--ctx.fuel;
			ctx.dataStack.pop();
			return Promise.resolve(ctx);
		}
	},
	"swap": <RuntimeWord>{
		name: "swap",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			--ctx.fuel;
			const b = ctx.dataStack.pop();
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(b);
			ctx.dataStack.push(a);
			return Promise.resolve(ctx);
		}
	},
}

export const jumpWords:KeyedList<Word> = {
	"goto": <RuntimeWord>{
		name: "goto",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			--ctx.fuel;
			ctx.ip = ctx.dataStack.pop();
			return Promise.resolve(ctx);
		}
	},
}

export const rsWords:KeyedList<Word> = {
	"call": <RuntimeWord>{
		name: "call",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			--ctx.fuel;
			ctx.returnStack.push(ctx.ip);
			ctx.ip = ctx.dataStack.pop();
			return Promise.resolve(ctx);
		}
	},
	"exit": <RuntimeWord>{
		name: "exit",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			--ctx.fuel;
			ctx.ip = ctx.returnStack.pop();
			return Promise.resolve(ctx);
		}
	},
	">r": <RuntimeWord>{
		name: "push-to-return-stack",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			--ctx.fuel;
			ctx.returnStack.push(ctx.dataStack.pop());
			return Promise.resolve(ctx);
		}
	},
	"r>": <RuntimeWord>{
		name: "pop-from-return-stack",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			--ctx.fuel;
			ctx.dataStack.push(ctx.returnStack.pop());
			return Promise.resolve(ctx);
		}
	},
};

export function mergeDicts<T>(...dicts:KeyedList<T>[]):KeyedList<T> {
	const z:KeyedList<T> = {};
	for( let i in dicts ) {
		for( let k in dicts[i] ) {
			z[k] = dicts[i][k];
		}
	}
	return z;
}

export const standardWords = mergeDicts(arithmeticWords, stackWords, jumpWords, rsWords);
