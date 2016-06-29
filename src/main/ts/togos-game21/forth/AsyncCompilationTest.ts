/// <reference path="../../Promise.d.ts" />

import SourceLocation from './SourceLocation';
import Token, {TokenType} from './Token';
import Tokenizer from './Tokenizer';
import {
	WordType, Word, RuntimeWord, CompilationWord, RuntimeContext, CompilationContext, Program, URIRef
} from './rs1';
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

function atText( sl:SourceLocation ) {
	return "at "+sl.fileUri+":"+sl.lineNumber+","+sl.columnNumber;
}

const echoWord = {
	name: 'echo',
	wordType: WordType.OTHER_RUNTIME,
	forthRun: (ctx:RuntimeContext) => {
		ctx.output.push(ctx.dataStack.pop());
		ctx.fuel -= 10; // Fake IO is 'spensive!
		return Promise.resolve(ctx);
	}
};


function compileTokens( tokens:Token[], compilation:CompilationContext, sLoc:SourceLocation, skip:number=0 ) : Promise<Program> {
	return new Promise( (resolve,reject) => {
		const words = compilation.program;
		for( let i=skip; i<tokens.length; ++i ) {
			const token = tokens[i];
			if( token.type == TokenType.COMMENT ) continue;
			if( token.type == TokenType.DOUBLE_QUOTED ) {
				words.push( {
					name: "push literal string",
					wordType: WordType.PUSH_VALUE,
					forthRun: (ctx:RuntimeContext) => {
						ctx.dataStack.push(token.text);
						--ctx.fuel;
						return Promise.resolve(ctx);
					}
				} );
				continue;
			}
			
			switch( token.text ) {
			case 'echo':
				words.push( echoWord );
				break;
			case 'urn:file1': case 'urn:file2':
				words.push( {
					name: "push URI reference "+token.text,
					wordType: WordType.PUSH_URI_REF,
					valueUri: token.text,
					forthRun: (ctx:RuntimeContext) => Promise.reject("Can't interpret URI words at runtime")
				} );
				break;
			case 'eval':
				{
					const prevWord = compilation.program[compilation.program.length-1];
					if( prevWord.wordType == WordType.PUSH_URI_REF ) {
						compilation.program.pop(); // We're going to replace it!
						// Compile that thing,
						compileRef( { uri: prevWord.valueUri }, compilation ).
							// then continue compiling our thing
							then( (_) => compileTokens(tokens, compilation, sLoc, i+1) ).
							// And of course, when done...
							then( (program) => resolve(program) );
						return;
					} else {
						reject("Expected word before 'eval' to have a valueUri, but it does not.");
						return;
					}
				}
			default:
				reject("Unrecognized word '"+token.text+"' "+atText(token.sourceLocation));
				return;
			}
		}
		
		// Hey hey, we got to the end!
		resolve( compilation.program );
	} );
}

function compileSource( thing:string, compilation:CompilationContext, sLoc:SourceLocation ) : Promise<Program> {
	// Otherwise it's a string
	return new Promise( (resolve,reject) => {
		const tokens:Token[] = [];
		// TODO: Once this is working/committed,
		// change it to work in source chunks
		// (not have to wait for EOF to start compiling)
		const tokenizer = new Tokenizer( {
			token: (token) => tokens.push(token),
			end: () => resolve( compileTokens( tokens, compilation, sLoc ) )
		} );
		tokenizer.text( <string>thing );
		tokenizer.end();
	} );
}

function compileRef( ref:URIRef, compilation:CompilationContext ) : Promise<Program> {
	return fetch(ref.uri).then( (resolved) => {
		return compileSource(resolved, compilation, {
			fileUri: ref.uri,
			lineNumber: 1,
			columnNumber: 1
		})
	} );
}

function runContext( ctx:RuntimeContext ):Promise<RuntimeContext> {
	if( ctx.ip >= ctx.program.length || ctx.ip < 0 ) return Promise.resolve(ctx);
	return ctx.program[ctx.ip++].forthRun(ctx).then( runContext );
}

function runProgram( program:Program ) : Promise<RuntimeContext> {
	return runContext( {
		dataStack: [],
		output: [],
		program: program,
		ip: 0,
		fuel: 100,
	} );
}

let compileCtx:CompilationContext = { program: [], fixups: {} };
registerTestResult('AsyncCompilationTest - urn:file2 eval', compileRef( {uri: 'urn:file1'}, compileCtx ).then( (program) => {
	return runProgram( program );
}).then( (ctx) => {
	const res = ctx.output.join('');
	assertEquals( 'foobarbaz', res );
	return { }
}));
