/// <reference path="../../Promise.d.ts" />

import SourceLocation from './SourceLocation';
import Token, {TokenType} from './Token';
import Tokenizer from './Tokenizer';
import {
	WordType, Word, RuntimeWord, CompilationWord, RuntimeContext, CompilationContext, Program,
	compileSource, compileTokens, makeWordGetter
} from './rs1';
import KeyedList from '../KeyedList';
import URIRef from '../URIRef';
import { TestResult, registerTestResult, assertEquals } from '../testing';

function runContext( ctx:RuntimeContext ):Promise<RuntimeContext> {
	if( ctx.ip >= ctx.program.length || ctx.ip < 0 ) return Promise.resolve(ctx);
	return ctx.program[ctx.ip++].forthRun(ctx).then( runContext );
}

function runProgram( program:Program ) : Promise<RuntimeContext> {
	return runContext( {
		dataStack: [],
		returnStack: [],
		output: [],
		program: program,
		ip: 0,
		fuel: 100,
	} );
}

const words : KeyedList<Word> = {
	"+": <RuntimeWord>{
		name: "+",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
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
			const b = ctx.dataStack.pop();
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(a / b);
			return Promise.resolve(ctx);
		}
	},
	"dup": <RuntimeWord>{
		name: "dup",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
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
			ctx.dataStack.pop();
			return Promise.resolve(ctx);
		}
	},
	"swap": <RuntimeWord>{
		name: "swap",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			const b = ctx.dataStack.pop();
			const a = ctx.dataStack.pop();
			ctx.dataStack.push(b);
			ctx.dataStack.push(a);
			return Promise.resolve(ctx);
		}
	},
	"goto": <RuntimeWord>{
		name: "goto",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			ctx.ip = ctx.dataStack.pop();
			return Promise.resolve(ctx);
		}
	},
	"call": <RuntimeWord>{
		name: "call",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			ctx.returnStack.push(ctx.ip);
			ctx.ip = ctx.dataStack.pop();
			return Promise.resolve(ctx);
		}
	},
	"exit": <RuntimeWord>{
		name: "exit",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			ctx.ip = ctx.returnStack.pop();
			return Promise.resolve(ctx);
		}
	},
};

const wordGetter = makeWordGetter( words, (text:string) => {
	if( /^[+-]?\d+$/.test(text) ) {
		return {
			name: text,
			wordType: WordType.PUSH_VALUE,
			value: +text,
			forthRun: function(ctx:RuntimeContext) {
				ctx.dataStack.push(this.value);
				return Promise.resolve(ctx)
			}
		};
	}
	return null;
});


function registerResultStackTest( name:string, s:any[], source:string ) {
	const compileCtx:CompilationContext = {
		program: [],
		getWord: wordGetter,
		fixups: {}
	};

	const res:Promise<TestResult> = compileSource(source, compileCtx, {fileUri:"test"+name, lineNumber:1, columnNumber:1} ).
		then( (compileCtx:CompilationContext) => {
			return runProgram( compileCtx.program );
		}).then( (runtimeCtx:RuntimeContext):TestResult => {
			assertEquals( s, runtimeCtx.dataStack );
			return { }
		});

	registerTestResult("RegularStuffTest - "+name, res);
}

registerResultStackTest( "stack ops", [1, 3, 2, 2], "1 2 3 4 drop swap dup" );
registerResultStackTest( "basic arithmetic", [-3, -1.5], "1 2 + 3 4 - * dup 2 /" );

registerResultStackTest( "goto", [1, 2, 3, 4], "1 2 7 goto 6 6 6 3 4" );
registerResultStackTest( "call", [1, 2, 3, 4, 5, 6], "1 2 8 call 5 6 -1 goto 3 4 exit" );
