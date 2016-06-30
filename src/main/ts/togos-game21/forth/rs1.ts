// Runtime System 1

import Token, { TokenType } from './Token';
import Tokenizer from './Tokenizer';
import SourceLocation from './SourceLocation';
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
	getWord : (text:string) => Word;
	fixups : KeyedList<Fixup<number>>
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
	return "at "+sl.fileUri+":"+sl.lineNumber+","+sl.columnNumber;
}

export function compileTokens( tokens:Token[], compilation:CompilationContext, sLoc:SourceLocation, skip:number=0 ) : Promise<CompilationContext> {
	return new Promise( (resolve,reject) => {
		const program = compilation.program;
		for( let i=skip; i<tokens.length; ++i ) {
			const token = tokens[i];
			if( token.type == TokenType.COMMENT ) continue;
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
				continue;
			}
			
			const word = compilation.getWord(token.text);
			if( word == null ) {
				reject("Unrecognized word '"+token.text+"' "+atText(token.sourceLocation));
				return;
			}
			
			switch( word.wordType ) {
			case WordType.PUSH_VALUE:
			case WordType.PUSH_URI_REF:
			case WordType.OTHER_RUNTIME:
				program.push( <RuntimeWord>word );
				continue;
			case WordType.OTHER_COMPILETIME:
				resolve(
					(<CompilationWord>word).forthCompile(compilation).
						// then continue compiling our thing
						then( (_) => compileTokens(tokens, compilation, sLoc, i+1) )
				);
				return;
			default:
				reject("Bad word type: "+word.wordType);
				return;
			}
		}
		
		// Hey hey, we got to the end!
		resolve( compilation );
	} );
}

export function compileSource( source:string, compilation:CompilationContext, sLoc:SourceLocation ) : Promise<CompilationContext> {
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
		tokenizer.text( <string>source );
		tokenizer.end();
	} );
}

export type WordGetter = (text:string)=>Word;

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
 * Run a program until ip goes out of bounds or its fuel runs out
 */
export function runContext( ctx:RuntimeContext ):Promise<RuntimeContext> {
	if( ctx.fuel <= 0 || ctx.ip >= ctx.program.length || ctx.ip < 0 ) return Promise.resolve(ctx);
	return ctx.program[ctx.ip++].forthRun(ctx).then( runContext );
}
