/// <reference path="../../Promise.d.ts" />

import SourceLocation from './SourceLocation';
import Token, {TokenType} from './Token';
import Tokenizer from './Tokenizer';
import {
	WordType, Word, RuntimeWord, CompilationWord, RuntimeContext, CompilationContext, Program,
	compileSource, compileTokens, runContext
} from './rs1';
import { standardWords, makeWordGetter, parseNumberWord } from './rs1words';
import KeyedList from '../KeyedList';
import URIRef from '../URIRef';
import { TestResult, registerTestResult, assertEquals } from '../testing';

function runProgram( program:Program ) : Promise<RuntimeContext> {
	const ctx : RuntimeContext = {
		dataStack: [],
		returnStack: [],
		program: program,
		ip: 0,
		fuel: 100,
	};
	const p = runContext( ctx );
	return p == null ? Promise.resolve(ctx) :<Promise<RuntimeContext>>p;
}

const wordGetter = makeWordGetter( standardWords, parseNumberWord );

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

registerResultStackTest( "mess with return stack", [3, 4, 7, 8], "13 >r 7 >r exit 1 2 3 4 r> goto 5 6 7 8" );