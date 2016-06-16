/// <reference path="../../Promise.d.ts" />

import KeyedList from '../KeyedList';
import Token, { TokenType } from './Token';
import { TokenListener } from './Tokenizer';

// A simpler forth interpreter

interface Thread {
	dataStack:any[];
	returnStack:number[];
	program:Word[];
	pc:number;
}

interface WordResult {
	cost:number;
}

const STANDARD_RESULT:WordResult = { cost: 1 };
const STANDARD_RESULT_PROMISE:Promise<WordResult> = new Promise<WordResult>( (resolve, reject) => {
	resolve(STANDARD_RESULT);
});

interface Word {
	name:string;
	call( interp:Interpreter, thread:Thread ):Promise<WordResult>;
}

abstract class RuntimeWord implements Word {
	public name:string;
	protected abstract run( interp:Interpreter, thread:Thread ):void;
	public call( interp:Interpreter, thread:Thread ):Promise<WordResult> {
		if( interp.isCompiling ) {
			thread.program.push(this);
		} else {
			this.run(interp, thread);
		}
		return STANDARD_RESULT_PROMISE;
	}
}

type TokenHandler = ( token:Token, interp:Interpreter, thread:Thread )=>void;

class PushValueWord extends RuntimeWord implements Word {
	public constructor( public value:any ) {
		super();
	}
	public get name() { return ""+this.value; }
	public run( interp:Interpreter, thread:Thread ) {
		thread.dataStack.push(this.value);
	}
}

const ONTOKEN_NORMAL = (token:Token, interp:Interpreter, thread:Thread) => {
	const w:Word = interp.tokenToWord(token);
	if( w == null ) return;
	w.call( interp, thread );
};

export default class Interpreter implements TokenListener {
	public words:KeyedList<Word>;
	public onToken:TokenHandler = ONTOKEN_NORMAL;
	public isCompiling:boolean;
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
		case TokenType.COMMENT: return null;
		case TokenType.DOUBLE_QUOTED: return new PushValueWord(token.text);
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
	
	public token( token:Token ):void {
		this.onToken.call( this, token );
	}
	
	public end():void { }
}
