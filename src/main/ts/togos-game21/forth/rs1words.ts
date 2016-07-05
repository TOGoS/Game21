/// <reference path="../../Promise.d.ts" />

import { resolvedPromise, rejectedPromise } from '../promises';
import Token, { TokenType } from './Token';
import KeyedList from '../KeyedList';
import {
	Word, WordType, RuntimeWord, CompilationWord, RuntimeContext, CompilationContext, Program, WordGetter,
	atText, defineWordAndResolveFixup, pushFixupPlaceholder, fixupPlaceholderWord
} from './rs1';

export { fixupPlaceholderWord } from './rs1';

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
	"jump": <RuntimeWord>{
		name: "jump",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext):void => {
			--ctx.fuel;
			ctx.ip = ctx.dataStack.pop();
		}
	},
}

const exitWord:RuntimeWord = {
	name: "exit",
	wordType: WordType.OTHER_RUNTIME,
	forthRun: (ctx:RuntimeContext):void => {
		console.log("Let's take a looksie at the return stack before exiting.", ctx.returnStack);
		--ctx.fuel;
		const ret = ctx.returnStack.pop();
		ctx.ip = ret == null ? -1 : +ret;
	}
};

/** Words that deal with the return stack */
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
	"exit": exitWord,
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

export const wordDefinitionWords:KeyedList<Word> = {
	"code-label:": <CompilationWord>{
		name: "code-label:",
		wordType: WordType.OTHER_COMPILETIME,
		forthCompile: (ctx:CompilationContext):void => {
			ctx.onToken = (nameT:Token) => {
				switch( nameT.type ) {
				case TokenType.BAREWORD: case TokenType.SINGLE_QUOTED:
					ctx.onToken = null;
					defineFixupPlaceholderGeneratorWords(ctx, nameT.text);
					return;
				case TokenType.END_OF_FILE:
					throw new Error("Encountered end of file when expecting label name "+atText(nameT.sourceLocation));
				case TokenType.DOUBLE_QUOTED:
					throw new Error("Encountered quoted string when expecting label name "+atText(nameT.sourceLocation));
				default:
					throw new Error("Unexpected token type "+nameT.type+" when expecting label name "+atText(nameT.sourceLocation));
				}
			}
		}
	},
	":": <CompilationWord>{
		name: ":",
		wordType: WordType.OTHER_COMPILETIME,
		forthCompile: (ctx:CompilationContext):void => {
			ctx.onToken = (nameT:Token) => {
				switch( nameT.type ) {
				case TokenType.BAREWORD: case TokenType.SINGLE_QUOTED:
					ctx.onToken = null;
					if( ctx.compilingMain ) {
						pushFixupPlaceholder(ctx, "jump:(resume main)");
					}
					defineLocation( ctx, nameT.text, ctx.program.length );
					ctx.onToken = null;
					ctx.compilingMain = false;
					return;
				case TokenType.END_OF_FILE:
					throw new Error("Encountered end of file when expecting word name "+atText(nameT.sourceLocation));
				case TokenType.DOUBLE_QUOTED:
					throw new Error("Encountered quoted string when expecting word name "+atText(nameT.sourceLocation));
				default:
					throw new Error("Unexpected token type "+nameT.type+" when expecting word name "+atText(nameT.sourceLocation));
				}
			};
		}
	},
	";": <CompilationWord>{
		name: ";",
		wordType: WordType.OTHER_COMPILETIME,
		forthCompile: (ctx:CompilationContext) : void|Thenable<CompilationContext> => {
			if( ctx.compilingMain ) return rejectedPromise(new Error("Weird ';' "+atText(ctx.sourceLocation)));

			ctx.program.push(exitWord);
			defineLocation( ctx, "(resume main)", ctx.program.length );
			ctx.compilingMain = true;
		}
	}
}

export function makeWordGetter( ...backups : WordGetter[] ) : WordGetter {
	return (text:string) => {
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

export function literalValueWord( v:any, name?:string ) : RuntimeWord {
	if( name == null ) name = ""+v;
	return {
		name: name,
		wordType: WordType.PUSH_VALUE,
		value: v,
		forthRun: function(ctx:RuntimeContext) {
			ctx.dataStack.push(this.value);
		}
	};
}

export function callWord( location:number, targetName:string ) : RuntimeWord {
	return <RuntimeWord> {
		name: "call:"+targetName,
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext) => {
			ctx.returnStack.push(ctx.ip);
			ctx.ip = location;
		}
	}
}

export class JumpWord implements RuntimeWord {
	wordType = WordType.OTHER_RUNTIME;
	constructor(public name:string, public location:number) { }
	forthRun(ctx:RuntimeContext) { ctx.ip = this.location; }
}

export function jumpWord( location:number, targetName:string ) : RuntimeWord {
	return new JumpWord("jump:"+targetName, location);
}

export function parseNumberWord( text:string ) : RuntimeWord {
	if( /^[+-]?\d+(\.\d+)?$/.test(text) ) {
		return literalValueWord( +text );
	}
	return null;
}

export function defineLocation( ctx:CompilationContext, name:string, loc:number ) {
	const locName = "$"+name;
	const callName = name;
	const jumpName = "jump:"+name;
	defineWordAndResolveFixup( ctx, callName, callWord(loc, name) );
	defineWordAndResolveFixup( ctx, jumpName, jumpWord(loc, name) );
	defineWordAndResolveFixup( ctx, locName , literalValueWord(loc, locName) );
}

/**
 * given a label name,
 * generate foo, $foo, and jump:$foo variants
 * that for now just append a placeholder word to the program and register a fixup at the placeholder's location
 */
function defineFixupPlaceholderGeneratorWords( ctx:CompilationContext, name:string ) {
	const variations = [name, "jump:"+name, "$"+name];
	for( let v in variations ) {
		const wName = variations[v];
		const placeholder = fixupPlaceholderWord(wName);
		ctx.dictionary[wName] = <CompilationWord>{
			name: wName,
			wordType: WordType.OTHER_COMPILETIME,
			forthCompile: (ctx:CompilationContext) => {
				pushFixupPlaceholder( ctx, wName, placeholder )
			}
		}
	}
}

export const standardWords = mergeDicts(arithmeticWords, stackWords, jumpWords, rsWords, wordDefinitionWords);
