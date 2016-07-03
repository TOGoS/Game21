/// <reference path="../../Promise.d.ts" />

import { resolvedPromise, rejectedPromise } from '../promises';
import Token, { TokenType } from './Token';
import KeyedList from '../KeyedList';
import {
	Word, WordType, RuntimeWord, CompilationWord, RuntimeContext, CompilationContext, Program, WordGetter,
	atText, defineAndResolveFixup, pushFixupPlaceholder, fixupPlaceholderWord
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
	"goto": <RuntimeWord>{
		name: "goto",
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
		--ctx.fuel;
		ctx.ip = ctx.returnStack.pop();
	}
};

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
	":": <CompilationWord>{
		name: ":",
		wordType: WordType.OTHER_COMPILETIME,
		forthCompile: (ctx:CompilationContext):Promise<CompilationContext> => {
			return new Promise<CompilationContext>( (resolve,reject) => {
				ctx.onToken = (nameT:Token) => {
					switch( nameT.type ) {
					case TokenType.BAREWORD: case TokenType.SINGLE_QUOTED:
						ctx.onToken = null;
						if( ctx.compilingMain ) {
							pushFixupPlaceholder(ctx, "(resume main)");
						}
						defineLocation( ctx, nameT.text, ctx.program.length );
						ctx.onToken = null;
						ctx.compilingMain = false;
						return;
					case TokenType.END_OF_FILE:
						return reject("Encountered end of file when expecting word name "+atText(nameT.sourceLocation));
					case TokenType.DOUBLE_QUOTED:
						return reject("Encountered quoted string when expecting word name "+atText(nameT.sourceLocation));
					default:
						return reject("Unexpected token type "+nameT.type+" when expecting word name "+atText(nameT.sourceLocation));
					}
				}
			}); 
		}
	},
	";": <CompilationWord>{
		name: ";",
		wordType: WordType.OTHER_COMPILETIME,
		forthCompile: (ctx:CompilationContext) : void|Thenable<CompilationContext> => {
			if( ctx.compilingMain ) return rejectedPromise("Weird ';' "+atText(ctx.sourceLocation));

			ctx.program.push(exitWord);
			const resumeMainWord = jumpWord(ctx.program.length, "(resume main)"); 
			const resumeMainFixup = ctx.fixups["(resume main)"];
			if( resumeMainFixup ) {
				for( let i in resumeMainFixup.references ) {
					resumeMainFixup[i]( resumeMainWord );
				}
			}
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

export function jumpWord( location:number, targetName:string ) : RuntimeWord {
	return <RuntimeWord> {
		name: "jump:"+targetName,
		wordType: WordType.OTHER_RUNTIME,
		forthRun: (ctx:RuntimeContext) => {
			ctx.ip = location;
		}
	}
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
	defineAndResolveFixup( ctx, callName, callWord(loc, name) );
	defineAndResolveFixup( ctx, jumpName, jumpWord(loc, name) );
	defineAndResolveFixup( ctx, locName , literalValueWord(loc, locName) );
}

export const standardWords = mergeDicts(arithmeticWords, stackWords, jumpWords, rsWords);
