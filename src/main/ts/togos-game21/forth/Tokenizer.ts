import SourceLocation from './SourceLocation';
import Token, {QuoteType} from './Token';

export interface TokenListener {
	token(token:Token):void;
	end():void;
}

export default class Tokenizer {
	protected textBuffer:string = "";
	protected tokenListener:TokenListener;
	
	constructor(l:TokenListener) {
		this.tokenListener = l;
	}
	
	public char(c:number) {
		throw new Error("Tokenizer#char(...) not yet supported");
	}
	public sourceLocation(sl:SourceLocation) {
		// Indicate source location of next character
	}
	public text(text:string) {
		if( this.textBuffer == null ) throw new Error("Already ended");
		/*
		for( let i=0; i<text.length; ++i ) {
			this.char(text.charCodeAt(i));
		}
		*/
		this.textBuffer += text;
	}
	public end() {
		if( this.textBuffer == null ) throw new Error("Already ended");
		const tokenStrings:string[] = this.textBuffer.split(/\s+/);
		for( let i=0; i<tokenStrings.length; ++i ) {
			this.tokenListener.token(new Token(tokenStrings[i], QuoteType.BAREWORD, null));
		}
		this.tokenListener.end();
		this.textBuffer = null;
	}
}
