/// <reference path="../../Promise.d.ts" />

import KeyedList from '../KeyedList';
import Token, { TokenType } from './Token';
import { TokenListener } from './Tokenizer';

// A simpler forth interpreter

export interface Thread {
	dataStack:any[];
	returnStack:number[];
	program:Word[];
	pc:number;
}

export interface WordResult {
	cost:number;
}

export const STANDARD_RESULT:WordResult = { cost: 1 };
export const STANDARD_RESULT_PROMISE:Promise<WordResult> = new Promise<WordResult>( (resolve, reject) => {
	resolve(STANDARD_RESULT);
});

export interface Word {
	name:string;
	call( interp:Interpreter, thread:Thread ):Promise<WordResult>;
}

export class SynchronousRuntimeWord implements Word {
	public constructor(public name:string, public runCallback:(interp:Interpreter, thread:Thread)=>void ) { }
	public call( interp:Interpreter, thread:Thread ):Promise<WordResult> {
		if( interp.isCompiling ) {
			thread.program.push(this);
		} else {
			this.runCallback.call(this, interp, thread);
		}
		return STANDARD_RESULT_PROMISE;
	}
}

type TokenHandler = ( token:Token, interp:Interpreter, thread:Thread )=>void;

class PushValueWord extends SynchronousRuntimeWord implements Word {
	public constructor( public value:any ) {
		super(""+value, (interp,thread) => thread.dataStack.push(this.value));
	}
}

const ONTOKEN_NORMAL:TokenHandler = (token:Token, interp:Interpreter, thread:Thread) => {
	const w:Word = interp.tokenToWord(token);
	if( w == null ) return;
	w.call( interp, thread );
};

export default class Interpreter {
	public words:KeyedList<Word> = {};
	public onToken:TokenHandler = ONTOKEN_NORMAL;
	public isCompiling:boolean = false;
	public threads:Thread[] = [
		{
			dataStack: [],
			returnStack: [],
			program: [],
			pc: null
		}
	];
	
	public tokenToWord( token:Token ):Word {
		switch( token.type ) {
		case TokenType.COMMENT:
			return null;
		case TokenType.DOUBLE_QUOTED:
			return new PushValueWord(token.text);
		case TokenType.SINGLE_QUOTED: case TokenType.BAREWORD:
			if( this.words[token.text] ) return this.words[token.text];
			if( token.text.match(/^\d+(\.\d+)?$/) ) {
				return new PushValueWord(+token.text);
			}
			throw new Error("Unrecognized word: "+token.text);
		default:
			throw new Error("Unrecognized token type: "+token.type);
		}
	}
	
	public defineWords( words:KeyedList<Word> ):void {
		for( let k in words ) this.words[k] = words[k];
	}
	
	public token( token:Token ):void {
		this.onToken( token, this, this.threads[0] );
	}
	
	public end():void { }
}
