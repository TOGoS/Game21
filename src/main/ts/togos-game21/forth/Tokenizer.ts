import KeyedList from '../KeyedList';
import SourceLocation from './SourceLocation';
import Token, {TokenType} from './Token';
import { resolvedPromise, vopToPromise, shortcutThen } from '../promises';

export type TokenListener = (t:Token) => Promise<void>|void;

const C_BEL   = 0x07;
const C_TAB   = 0x09;
const C_NL    = 0x0A;
const C_VT    = 0x0B;
const C_FF    = 0x0C;
const C_CR    = 0x0D;
const C_ESC   = 0x1B;
const C_SPACE = 0x20;

const C_A = 'a'.charCodeAt(0);
const C_E = 'e'.charCodeAt(0);
const C_F = 'f'.charCodeAt(0);
const C_N = 'n'.charCodeAt(0);
const C_R = 'r'.charCodeAt(0);
const C_T = 't'.charCodeAt(0);
const C_V = 'v'.charCodeAt(0);
const C_SHARP = 0x23;
const C_DOUBLE_QUOTE = 0x22;
const C_BACKSLASH = 0x5C;
const C_SINGLE_QUOTE = 0x27;
const C_OPEN_SINGLE_ANGLE_QUOTE  = "‹".charCodeAt(0);
const C_CLOSE_SINGLE_ANGLE_QUOTE = "›".charCodeAt(0);
const C_OPEN_DOUBLE_ANGLE_QUOTE  = "«".charCodeAt(0);
const C_CLOSE_DOUBLE_ANGLE_QUOTE = "»".charCodeAt(0);

class QuoteStyle {
	public constructor(
		public openCharCode:number,
		public closeCharCode:number,
		public backslashEscapes:boolean,
		public tokenType:TokenType
	) { }
}

export default class Tokenizer {
	/**
	 * Lists end-quote characters that we're awaiting, from inner-most to outer-most.
	 * If empty, we're not inside any quotes at all.
	 */
	protected handlingBackslashEscape:boolean = false;
	protected awaitingCloseQuoteChars:number[] = [];
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
			new QuoteStyle( C_SINGLE_QUOTE, C_SINGLE_QUOTE, true, TokenType.SINGLE_QUOTED ),
			new QuoteStyle( C_DOUBLE_QUOTE, C_DOUBLE_QUOTE, true, TokenType.DOUBLE_QUOTED ),
			new QuoteStyle( C_OPEN_SINGLE_ANGLE_QUOTE, C_CLOSE_SINGLE_ANGLE_QUOTE, false, TokenType.SINGLE_QUOTED ),
			new QuoteStyle( C_OPEN_DOUBLE_ANGLE_QUOTE, C_CLOSE_DOUBLE_ANGLE_QUOTE, false, TokenType.DOUBLE_QUOTED ),
		];
	}
	
	protected quoteStylesByOpenChar : KeyedList<QuoteStyle> = {};
	protected quoteStylesByCloseChar : KeyedList<QuoteStyle> = {};
	public set quoteStyles(styles:QuoteStyle[]) {
		this.quoteStylesByOpenChar = {};
		this.quoteStylesByCloseChar = {};
		for( let i in styles ) {
			const style = styles[i];
			this.quoteStylesByOpenChar[style.openCharCode] = style;
			this.quoteStylesByCloseChar[style.closeCharCode] = style;
		}
	}
	
	/** Adjust source location after processing a character */
	protected postChar(c:number):void {
		switch(c) {
		case C_NL:
			++this.sourceLineNumber;
			this.sourceColumnNumber = 1;
			break;
		case C_TAB:
			this.sourceColumnNumber = (Math.floor((this.sourceColumnNumber-1) / 8) + 1) * 8 + 1;
			break;
		default:
			++this.sourceColumnNumber;
			break;
		}
	}
	
	protected flushToken() : Promise<void>|void {
		if( this.tokenBuffer.length == 0 && this.tokenType == TokenType.BAREWORD ) {
			// Nothing to flush! Ahahahah1!!
			return;
		}
		
		const p = this.tokenListener(new Token( this.tokenBuffer, this.tokenType, {
			fileUri: this.sourceFileUri,
			lineNumber: this.tokenStartLineNumber,
			columnNumber: this.tokenStartColumnNumber,
			endLineNumber: this.sourceLineNumber,
			endColumnNumber: this.sourceColumnNumber
		}));
		
		this.tokenBuffer = "";
		this.tokenType = TokenType.BAREWORD;
		return p;
	}
	
	protected get atstr():string {
		return "at "+this.sourceFileUri+":"+this.sourceLineNumber+","+this.sourceColumnNumber;
	}
	
	protected _char(c:number) : Promise<void>|void {
		if( this.ended ) throw new Error("Already ended");

		if( this.handlingBackslashEscape ) {
			let decoded:number;
			switch( c ) {
			case C_A: decoded = C_BEL; break;
			case C_E: decoded = C_ESC; break;
			case C_F: decoded = C_FF; break;
			case C_N: decoded = C_NL; break;
			case C_R: decoded = C_CR; break;
			case C_T: decoded = C_TAB; break;
			case C_V: decoded = C_VT; break;
			case C_BACKSLASH: case C_DOUBLE_QUOTE: case C_SINGLE_QUOTE:
				decoded = c; break;
			default:
				throw new Error("Invalid backslash escape sequence: \\"+String.fromCharCode(c)+" "+this.atstr);
			}
			this.tokenBuffer += String.fromCharCode(decoded);
			this.postChar(c);
			this.handlingBackslashEscape = false;
			return;
		} else if( this.awaitingCloseQuoteChars.length == 0 ) {
			switch( c ) {
			case C_TAB: case C_VT: case C_NL: case C_FF: case C_CR: case C_SPACE:
				{
					const p:Promise<void>|void = this.flushToken();
					this.postChar(c);
					return p;
				}
			default:
				const quoteStyle = this.quoteStylesByOpenChar[c];
				if( quoteStyle ) {
					if( this.tokenBuffer.length != 0 ) {
						throw new Error("Open-quote found in middle of token ("+this.tokenBuffer+") "+this.atstr);
					}
					this.tokenStartLineNumber = this.sourceLineNumber;
					this.tokenStartColumnNumber = this.sourceColumnNumber;
					this.tokenType = quoteStyle.tokenType;
					this.awaitingCloseQuoteChars.unshift( quoteStyle.closeCharCode );
					this.postChar(c);
					return;
				}
				
				if( this.tokenBuffer.length == 0 ) {
					this.tokenStartLineNumber = this.sourceLineNumber;
					this.tokenStartColumnNumber = this.sourceColumnNumber;
				}
				this.tokenBuffer += String.fromCharCode(c);
				this.postChar(c);
				return;
			}
		} else {
			if( this.awaitingCloseQuoteChars[0] == c ) {
				this.awaitingCloseQuoteChars.shift();
				if( this.awaitingCloseQuoteChars.length == 0 ) {
					this.postChar(c);
					return this.flushToken();
				}
			}
			const currentCloseChar = this.awaitingCloseQuoteChars[0];
			const style = this.quoteStylesByCloseChar[currentCloseChar];
			if( style == null ) throw new Error("Failed to find quote for close quote "+String.fromCharCode(currentCloseChar));
			if( style.backslashEscapes && c == C_BACKSLASH ) {
				this.handlingBackslashEscape = true;
				this.postChar(c);
				return;
			}
			if( style.openCharCode == c ) {
				this.awaitingCloseQuoteChars.unshift( style.closeCharCode );
			}
			this.tokenBuffer += String.fromCharCode(c);
			this.postChar(c);
			return;
		}
	}
	public set sourceLocation(sl:SourceLocation) {
		this.sourceLineNumber = sl.lineNumber;
		this.sourceColumnNumber = sl.columnNumber;
		this.sourceFileUri = sl.fileUri;
	}
	public text(text:string, skip:number=0) : Thenable<void> {
		for( let i=skip; i<text.length; ++i ) {
			let p : Promise<void>|void;
			if( (p = this._char(text.charCodeAt(i))) != null ) {
				return (<Promise<void>>p).then( () => this.text(text, i+1) );
			}
		}
		return resolvedPromise(null);
	}
	public end() : Thenable<void> {
		if( this.handlingBackslashEscape ) {
			throw new Error("Expected rest of backslash escape sequence but encountered end of stream "+this.atstr);
		}
		if( this.ended ) throw new Error("Already ended");
		if( this.awaitingCloseQuoteChars.length > 0 ) {
			throw new Error("Expected "+String.fromCharCode(this.awaitingCloseQuoteChars[0])+" but encountered end of stream "+this.atstr);
		}
		this.ended = true;
		return shortcutThen(
			vopToPromise( this.flushToken(), null ),
			() => this.tokenListener({
				type: TokenType.END_OF_FILE,
				text: "",
				sourceLocation: {
					fileUri: this.sourceFileUri,
					lineNumber: this.sourceLineNumber,
					columnNumber: this.sourceColumnNumber,
					endLineNumber: this.sourceLineNumber,
					endColumnNumber: this.sourceColumnNumber,
				}
			})
		);
	}
}
