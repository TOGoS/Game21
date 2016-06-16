import SourceLocation from './SourceLocation';
import Token, {TokenType} from './Token';

export interface TokenListener {
	token(token:Token):void;
	end():void;
}

const C_TAB   = 0x09;
const C_NL    = 0x0A;
const C_VT    = 0x0B;
const C_FF    = 0x0C;
const C_CR    = 0x0D;
const C_SPACE = 0x20;

const C_SHARP = 0x23;
const C_DOUBLE_QUOTE = 0x22;
const C_BACKSLASH = 0x5C;
const C_SINGLE_QUOTE = 0x27;

class QuoteStyle {
	public constructor(
		public openCharCode:number,
		public closeCharCode:number,
		public nestable:boolean,
		public backslashEscapes:boolean,
		public isLiteral:boolean
	) { }
}

export default class Tokenizer {
	/**
	 * Lists end-quote characters that we're awaiting, from inner-most to outer-most.
	 * If empty, we're not inside any quotes at all.
	 */
	protected endQuoteChars:number[] = [];
	protected tokenType:TokenType = TokenType.BAREWORD;
	protected tokenBuffer:string = "";
	protected tokenListener:TokenListener;
	protected tokenStartLineNumber:number = 1;
	protected tokenStartColumnNumber:number = 1;
	protected sourceLineNumber:number = 1;
	protected sourceColumnNumber:number = 1;
	protected sourceFileUri:string = "(anonymous source buffer)";
	protected ended:boolean = false;
	
	public constructor(l:TokenListener) {
		this.tokenListener = l;
		this.quoteStyles = [
			new QuoteStyle( C_DOUBLE_QUOTE, C_DOUBLE_QUOTE, false, true, true ),
			new QuoteStyle( C_SINGLE_QUOTE, C_SINGLE_QUOTE, false, true, true ),
		];
	}
	
	public set quoteStyles(styles:QuoteStyle[]) {
	}
	
	/** Adjust source location after processing a character */
	protected postChar(c:number):void {
		switch(c) {
		case C_NL:
			++this.sourceLineNumber;
			this.sourceColumnNumber = 1;
			break;
		default:
			++this.sourceColumnNumber;
			break;
		}
	}
	
	protected flushToken():void {
		if( this.tokenBuffer.length == 0 && this.tokenType == TokenType.BAREWORD ) {
			// Nothing to flush! Ahahahah1!!
			return;
		}
		
		this.tokenListener.token(new Token( this.tokenBuffer, this.tokenType, {
			fileUri: this.sourceFileUri,
			lineNumber: this.tokenStartLineNumber,
			columnNumber: this.tokenStartColumnNumber,
			endLineNumber: this.sourceLineNumber,
			endColumnNumber: this.sourceColumnNumber
		}));
		
		this.tokenBuffer = "";
		this.tokenType = TokenType.BAREWORD;
	}
	
	public char(c:number):void {
		if( this.ended ) throw new Error("Already ended");
		
		if( this.endQuoteChars.length == 0 ) {
			switch( c ) {
			case C_TAB: case C_VT: case C_NL: case C_FF: case C_CR: case C_SPACE:
				this.postChar(c);
				this.flushToken();
				return;
			default:
				if( this.tokenBuffer.length == 0 ) {
					this.tokenStartLineNumber = this.sourceLineNumber;
					this.tokenStartColumnNumber = this.sourceColumnNumber;
				}
				this.tokenBuffer += String.fromCharCode(c);
				this.postChar(c);
				return;
			}
		} else {
			throw new Error("Quoting not yet spported");
		}
	}
	public set sourceLocation(sl:SourceLocation) {
		this.sourceLineNumber = sl.lineNumber;
		this.sourceColumnNumber = sl.columnNumber;
		this.sourceFileUri = sl.fileUri;
	}
	public text(text:string):void {
		for( let i=0; i<text.length; ++i ) {
			this.char(text.charCodeAt(i));
		}
	}
	public end():void {
		this.flushToken();
		if( this.ended ) throw new Error("Already ended");
		if( this.endQuoteChars.length > 0 ) {
			throw new Error("Expected "+String.fromCharCode(this.endQuoteChars[0])+" but encountered end of stream");
		}
		this.ended = true;
	}
}
