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
	words : KeyedList<Word>;
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
			
			const word = compilation.words[token.text];
			if( word != null ) {
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
					throw new Error("Bad word type: "+word.wordType);
				}
			}
			
			switch( token.text ) {
			case 'urn:file1': case 'urn:file2':
				program.push( {
					name: "push URI reference "+token.text,
					wordType: WordType.PUSH_URI_REF,
					valueUri: token.text,
					forthRun: (ctx:RuntimeContext) => Promise.reject("Can't interpret URI words at runtime")
				} );
				break;
			default:
				reject("Unrecognized word '"+token.text+"' "+atText(token.sourceLocation));
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
