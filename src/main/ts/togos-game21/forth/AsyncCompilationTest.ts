/// <reference path="../../Promise.d.ts" />

import SourceLocation from '../lang/SourceLocation';
import Token, {TokenType} from '../lang/Token';
import Tokenizer from '../lang/Tokenizer';
import {
	WordType, Word, RuntimeWord, CompilationWord, RuntimeContext, CompilationContext, Program,
	compileSource, compileTokens, makeWordGetter, runContext
} from './rs1';
import KeyedList from '../KeyedList';
import URIRef from '../URIRef';
import { registerTestResult, assertEquals } from '../testing';

/*
 * Oh jeez why is this so hard.
 *
 * urn:file1:
 * 
 *   "foo" echo
 *   urn:file2 eval
 "   "baz" echo
 * 
 * urn:file2:
 * 
 *   "bar" echo
 *
 * Result should be "foobarbaz"
 */

function fetch( ref:string ):Promise<string> {
	return new Promise( (resolve,reject) => {
		setTimeout( () => {
			if( ref == 'urn:file1' ) {
				resolve('"foo" echo\nurn:file2 eval\n"baz" echo');
			} else if( ref == 'urn:file2' ) {
				resolve('"bar" echo');
			} else {
				reject(ref+' not found');
			}
		}, 10 );
	});
}

function compileRef( ref:URIRef, compilation:CompilationContext ) : Promise<CompilationContext> {
	return fetch(ref.uri).then( (resolved) => {
		return compileSource(resolved, compilation, {
			filename: ref.uri,
			lineNumber: 1,
			columnNumber: 1
		})
	} );
}

interface ACTRuntimeContext extends RuntimeContext {
	output: string[]
}			

function runProgram( program:Program ) : Promise<ACTRuntimeContext> {
	const runtimeCtx = <ACTRuntimeContext>{
		dataStack: [],
		returnStack: [],
		output: <string[]>[],
		program: program,
		ip: 0,
		fuel: 100,
	};
	const p = runContext( runtimeCtx );
	return p == null ? Promise.resolve(runtimeCtx) : <Promise<ACTRuntimeContext>>p;
}

const words : KeyedList<Word> = {
	echo: <RuntimeWord>{
		name: 'echo',
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):Promise<RuntimeContext> => {
			(<ACTRuntimeContext>ctx).output.push(ctx.dataStack.pop());
			ctx.fuel -= 10; // Fake IO is 'spensive!
			return Promise.resolve(ctx);
		}
	},
	eval: <CompilationWord>{
		name: 'eval',
		wordType: WordType.OTHER_COMPILETIME,
		forthCompile: (compilation:CompilationContext):Promise<CompilationContext> => {
			const prevWord = compilation.program[compilation.program.length-1];
			if( prevWord.wordType == WordType.PUSH_URI_REF ) {
				compilation.program.pop(); // We're going to replace it!
				// Compile that thing,
				if( !prevWord.valueUri ) throw new Error("PUSH_URI_REF word lacks valueUri!");
				return compileRef( { uri: prevWord.valueUri }, compilation );
			} else {
				return Promise.reject("Expected word before 'eval' to have a valueUri, but it does not.");
			}
		}
	}
};

function makeCompilationContext( dictionary:KeyedList<Word>, backup:(text:string)=>Word ) {
}

let compileCtx:CompilationContext = {
	program: [],
	dictionary: words,
	sourceLocation: {
		filename: "AsymcCompilationTest",
		lineNumber: 1,
		columnNumber: 1,
	},
	fallbackWordGetter: makeWordGetter( words, (text:string) => {
		if( /^urn:/.test(text) ) {
			return {
				name: text,
				wordType: WordType.PUSH_URI_REF,
				valueUri: text,
				forthRun: (ctx:RuntimeContext) => Promise.reject("Can't fetch URI at runtime")
			};
		}
		return null;
	}),
	fixups: {},
	onToken: null,
	compilingMain: true,
};
registerTestResult('AsyncCompilationTest - urn:file2 eval', compileRef( {uri: 'urn:file1'}, compileCtx ).then( (compileCtx) => {
	return runProgram( compileCtx.program );
}).then( (ctx:ACTRuntimeContext) => {
	const res = ctx.output.join('');
	assertEquals( 'foobarbaz', res );
	return { }
}));
