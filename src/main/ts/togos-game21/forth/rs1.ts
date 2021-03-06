/// <reference path="../../Promise.d.ts"/>

import { resolvedPromise, rejectedPromise } from '../promises';

// Runtime System 1

import Token, { TokenType } from '../lang/Token';
import Tokenizer from '../lang/Tokenizer';
import SourceLocation from '../lang/SourceLocation';
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
	forthCompile( ctx:CompilationContext ) : void|Promise<CompilationContext>;
}

export interface RuntimeWord extends Word {
	/** When this is a 'push literal value' word. */
	value? : any;
	valueUri? : string;
	/** If there's any asynchronousness that needs to be done, a promise is returned.  Otherwise null. */
	forthRun( ctx:RuntimeContext ) : Thenable<RuntimeContext>|void;
}

type FixupCallback<T> = (value:T, error?:Error|null)=>void;
interface Fixup<T> {
	value : T|null;
	// Why does the fixup need to track the placeholder?
	//placeholder? : T;
	references : FixupCallback<T>[];
}

export type TokenHandler = (token:Token) => void|Promise<CompilationContext>;

export type WordGetter = (text:string)=>Word|null;

export interface CompilationContext {
	/** Source location of the token being processed */
	sourceLocation : SourceLocation;
	program : Program;
	dictionary : KeyedList<Word>;
	fallbackWordGetter : WordGetter;
	onToken : TokenHandler|null;
	fixups : KeyedList<Fixup<RuntimeWord>>
	compilingMain : boolean;
}

export interface RuntimeContext {
	dataStack : any[];
	returnStack : number[];
	
	fuel : number;
	program : Program;
	ip : number;
}

export type Program = RuntimeWord[];

export function atText( sl:SourceLocation ) {
	return "at "+sl.filename+":"+sl.lineNumber+","+sl.columnNumber;
}

export function getWord( ctx:CompilationContext, text:string ):Word|null {
	let w = ctx.dictionary[text];
	if( w ) return ctx.dictionary[text];
	return ctx.fallbackWordGetter(text);
}

export function compileToken( token:Token, compilation:CompilationContext ) : void|Promise<CompilationContext> {
	compilation.sourceLocation = token.sourceLocation;
	if( compilation.onToken ) return compilation.onToken(token);

	const program = compilation.program;

	if( token.type == TokenType.END_OF_FILE ) return;
	if( token.type == TokenType.COMMENT ) return;
	if( token.type == TokenType.DOUBLE_QUOTED ) {
		program.push( {
			name: "push literal string",
			wordType: WordType.PUSH_VALUE,
			forthRun: (ctx:RuntimeContext) => {
				ctx.dataStack.push(token.text);
				--ctx.fuel;
				return Promise.resolve(ctx);
			}
		} );
		return;
	}
	
	const word = getWord(compilation, token.text);
	if( word == null ) {
		return Promise.reject(new Error("Unrecognized word '"+token.text+"' "+atText(token.sourceLocation)));
	}
	
	switch( word.wordType ) {
	case WordType.PUSH_VALUE:
	case WordType.PUSH_URI_REF:
	case WordType.OTHER_RUNTIME:
		program.push( <RuntimeWord>word );
		return;
	case WordType.OTHER_COMPILETIME:
		return (<CompilationWord>word).forthCompile(compilation);
	default:
		return Promise.reject(new Error("Bad word type: "+word.wordType));
	}
}

export function compileTokens( tokens:Token[], compilation:CompilationContext, skip:number=0 ) : Promise<CompilationContext> {
	for( let i=skip; i<tokens.length; ++i ) {
		const token = tokens[i];
		const p = compileToken(token, compilation);
		if( p ) return (<Promise<CompilationContext>>p).then( (ctx) => compileTokens(tokens, ctx, i+1 ) );
	}
	
	// Hey hey, we got to the end!
	return resolvedPromise(compilation);
}

export function compileSource( source:string, compilation:CompilationContext, sLoc:SourceLocation ) : Thenable<CompilationContext> {
	const tokenizer = new Tokenizer( (token:Token):void|Promise<void> => {
		const p = compileToken( token, compilation );
		if( p ) return (<Promise<CompilationContext>>p).then( () => {} );
		return;
	} );
	tokenizer.sourceLocation = sLoc;
	return tokenizer.text( <string>source ).then( () => tokenizer.end() ).then( () => compilation );
}

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

/**
 * Returns a promise that, upon completion, will have
 * run a program until ip goes out of bounds or its fuel runs out.
 * 
 * If you pass in a Promise<RuntimeContext> as the second parameter
 * and the program completes running without any asynchonicity,
 * that same promise will be returned.
 */
export function runContext( ctx:RuntimeContext ):Promise<RuntimeContext> {
	for( ; ctx.fuel > 0 && ctx.ip >= 0 && ctx.ip < ctx.program.length ; ) {
		//console.log("Running '"+ctx.program[ctx.ip].name+"' at ip="+ctx.ip);
		const word = ctx.program[ctx.ip++];
		let prom = word.forthRun(ctx);
		// prom = null?  continue synchronously; else finish running asynchronously and return promise
		if( prom != null ) return (<Promise<RuntimeContext>>prom).then( runContext );
	}
	//console.log("Program done (at "+ctx.ip+")!");
	return resolvedPromise(ctx);
}

export function fixupPlaceholderWord( name:string ) : RuntimeWord {
	const fullName = "fixup placeholder:"+name;
	return <RuntimeWord> {
		name: fullName,
		wordType: WordType.OTHER_RUNTIME,
		forthRun: () => rejectedPromise<RuntimeContext>( new Error("attempted to invoke "+fullName+", which was never fixed up") )
	}
}

export function pushFixupPlaceholder( ctx:CompilationContext, name:string, placeholderWord:RuntimeWord=fixupPlaceholderWord(name) ) {
	const loc = ctx.program.length;

	let fixup:Fixup<RuntimeWord>;
	if( (fixup = ctx.fixups[name]) == null ) fixup = ctx.fixups[name] = {
		value: null,
		//placeholder: placeholderWord,
		references: []
	};
	ctx.program.push( placeholderWord )
	fixup.references.push( (w:RuntimeWord) => ctx.program[loc] = w );
}

export function defineWordAndResolveFixup( ctx:CompilationContext, name:string, w:RuntimeWord ) {
	ctx.dictionary[name] = w;
	if( ctx.fixups[name] ) {
		const refs = ctx.fixups[name].references;
		for( let i in refs ) {
			refs[i](w, null);
		}
		//ctx.fixups[name].references.length = 0;
		delete ctx.fixups[name];
	}
}
