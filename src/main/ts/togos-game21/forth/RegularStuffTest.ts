/// <reference path="../../Promise.d.ts" />

import SourceLocation from './SourceLocation';
import Token, {TokenType} from './Token';
import Tokenizer from './Tokenizer';
import {
	WordType, Word, RuntimeWord, CompilationWord, RuntimeContext, CompilationContext, Program,
	compileSource, compileTokens, runContext
} from './rs1';
import { standardWords, mergeDicts, makeWordGetter, parseNumberWord } from './rs1words';
import KeyedList from '../KeyedList';
import URIRef from '../URIRef';
import { TestResult, registerTestResult, assertEqualsPromise } from '../testing';
import { vopToPromise } from '../promises';

function runProgram( program:Program ) : Promise<RuntimeContext> {
	const ctx : RuntimeContext = {
		dataStack: [],
		returnStack: [],
		program: program,
		ip: 0,
		fuel: 100,
	};
	return vopToPromise( runContext( ctx ), ctx );
}

const wordGetter = makeWordGetter( parseNumberWord );

const debugWords:KeyedList<RuntimeWord> = {
	"noop": <RuntimeWord> {
		name: "noop",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext) => { }
	},
	".s": <RuntimeWord> {
		name: ".s",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext) => {
			console.log(ctx.dataStack);
		}
	}
}

function registerResultStackTest( name:string, s:any[], source:string ) {
	const compileCtx:CompilationContext = {
		program: [],
		dictionary: mergeDicts(standardWords, debugWords),
		fallbackWordGetter: wordGetter,
		fixups: {},
		compilingMain: true,
		onToken: null,
		sourceLocation: {
			fileUri: 'registerResultStackTest',
			lineNumber: 1,
			columnNumber: 1
		}
	};
	
	const res:Promise<TestResult> = compileSource(source, compileCtx, {fileUri:"test:"+name, lineNumber:1, columnNumber:1} ).
		then( (compileCtx:CompilationContext) => {
			//console.log("Compiled "+name, compileCtx);
			return runProgram( compileCtx.program );
		}).then( (runtimeCtx:RuntimeContext):Promise<TestResult> => {
			//console.log("Got "+name+" program result", runtimeCtx.dataStack);
			return assertEqualsPromise( s, runtimeCtx.dataStack );
		});
	
	registerTestResult("RegularStuffTest - "+name, res);
}

registerResultStackTest( "stack ops", [1, 3, 2, 2], "1 2 3 4 drop swap dup" );
registerResultStackTest( "basic arithmetic", [-3, -1.5], "1 2 + 3 4 - * dup 2 /" );

registerResultStackTest( "jump", [1, 2, 3, 4], "1 2 7 jump 6 6 6 3 4" );
registerResultStackTest( "call", [1, 2, 3, 4, 5, 6], "1 2 8 call 5 6 -1 jump 3 4 exit" );

registerResultStackTest( "mess with return stack", [3, 4, 7, 8], "13 >r 7 >r exit 1 2 3 4 r> jump 5 6 7 8" );

registerResultStackTest( "call a user-defined function", [3, 1, 2], ": foo 1 2 ; 3 foo" )
registerResultStackTest( "call nested user-defined functions", [1, 2, 3, 4], ": add + ; : foo 1 2 add ; 1 2 foo 4" )

registerResultStackTest( "don't call a user-defined function", [3], ": foo 1 2 ; 3" )
registerResultStackTest( "call two user-defined function", [1, 2, 3, 4], ": three 3 ; 1 : four 4 ; 2 three four" )

registerResultStackTest( "jump to a user-defined function", [1, 2, 3],   ": foo 3 -1 jump ; 1 2 jump:foo " )
registerResultStackTest( "declare fixup", [1, 2],   "code-label: foo 1 2" )
registerResultStackTest( "use fixup fixup", [1, 3],   "code-label: foo 1 jump:foo 2 : foo 3" )

// These rely on 'exit' on an empty return stack quitting the program (by jumping to -1)
registerResultStackTest(
	"jump to a user-defined function 2", [1, 2, 4],
	"code-label: end : foo 1 2 jump:end  ; 3 drop jump:foo  : end 4 ;" )
registerResultStackTest(
	"jump to a user-defined function 3", [1, 2, 4],
	"code-label: end : foo 1 2 $end jump ; 3 drop $foo jump : end 4 ;" )
