import Token, { TokenType } from './Token';
import Tokenizer, { TokenListener } from './Tokenizer';

function assertEquals( expected:any, actual:any, message?:string ) {
	const expectedJson = JSON.stringify(expected, null, "   ");
	const actualJson = JSON.stringify(actual, null, "   ");
	console.assert( expectedJson == actualJson, expectedJson + " != " + actualJson + (message ? "; "+message : ""));
}

{
	let tokens : Token[] = [];
	let tokenizer = new Tokenizer( {
		token: (t:Token) => tokens.push(t),
		end: () => {}
	} );
	
	tokenizer.sourceLocation = {
		fileUri: "test",
		lineNumber: 1,
		columnNumber: 1
	};
	tokenizer.text("foo bar\n\tbaz");
	tokenizer.end();
	
	assertEquals( 3, tokens.length, "Should be 3 tokens!" );
	
	assertEquals( new Token("foo", TokenType.BAREWORD, {
		fileUri: "test",
		lineNumber: 1,
		columnNumber: 1,
		endLineNumber: 1,
		endColumnNumber: 4,
	}), tokens[0], "Token #0 mismatched" );
	assertEquals( new Token("bar", TokenType.BAREWORD, {
		fileUri: "test",
		lineNumber: 1,
		columnNumber: 5,
		endLineNumber: 1,
		endColumnNumber: 8,
	}), tokens[1], "Token #1 mismatched" );
	assertEquals( new Token("baz", TokenType.BAREWORD, {
		fileUri: "test",
		lineNumber: 2,
		columnNumber: 9,
		endLineNumber: 2,
		endColumnNumber: 12,
	}), tokens[2], "Token #2 mismatched" );
}
