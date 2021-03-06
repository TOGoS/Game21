import Token, { TokenType } from './Token';
import Tokenizer, { TokenListener } from './Tokenizer';

function assertEquals( expected:any, actual:any, message?:string ) {
	const expectedJson = JSON.stringify(expected, null, "   ");
	const actualJson = JSON.stringify(actual, null, "   ");
	if( expectedJson != actualJson ) {
		throw new Error( "Assertion failed: " + expectedJson + " != " + actualJson + (message ? "; "+message : ""));
	}
}

// Assign some initial values to trick the compiler a little bit.
let tokens : Token[] = [];
let tokenizer : Tokenizer = new Tokenizer( (t:Token) => { } );
	
function reset() {
	tokens = [];
	tokenizer = new Tokenizer( (t:Token) => { tokens.push(t) } );
	tokenizer.sourceLocation = {
		filename: "test",
		lineNumber: 1,
		columnNumber: 1
	};
}

// Test parsing some barewords
{
	reset();
	
	tokenizer.text("foo bar\n\tbaz");
	tokenizer.end();
	
	assertEquals( 4, tokens.length, "Should be 3 tokens (including the EOF one)!" );
	
	assertEquals( new Token("foo", TokenType.BAREWORD, {
		filename: "test",
		lineNumber: 1,
		columnNumber: 1,
		endLineNumber: 1,
		endColumnNumber: 4,
	}), tokens[0], "Token #0 mismatched" );
	assertEquals( new Token("bar", TokenType.BAREWORD, {
		filename: "test",
		lineNumber: 1,
		columnNumber: 5,
		endLineNumber: 1,
		endColumnNumber: 8,
	}), tokens[1], "Token #1 mismatched" );
	assertEquals( new Token("baz", TokenType.BAREWORD, {
		filename: "test",
		lineNumber: 2,
		columnNumber: 9,
		endLineNumber: 2,
		endColumnNumber: 12,
	}), tokens[2], "Token #2 mismatched" );
}

// Test parsing quoted strings
{
	reset();
	tokenizer.text('"foo bar" \'baz quux\' «\n\tjiffy ‹\'pop\' «bop›» corn\n»');
	tokenizer.end();

	assertEquals( 4, tokens.length, "Should've found 4 tokens (including the EOF one)" );
	
	assertEquals( new Token("foo bar", TokenType.DOUBLE_QUOTED, {
		filename: "test",
		lineNumber: 1,
		columnNumber: 1,
		endLineNumber: 1,
		endColumnNumber: 10,
	}), tokens[0], "Token #0 mismatched" );

	assertEquals( new Token("baz quux", TokenType.SINGLE_QUOTED, {
		filename: "test",
		lineNumber: 1,
		columnNumber: 11,
		endLineNumber: 1,
		endColumnNumber: 21,
	}), tokens[1], "Token #1 mismatched" );

	assertEquals( new Token("\n\tjiffy ‹'pop' «bop›» corn\n", TokenType.DOUBLE_QUOTED, {
		filename: "test",
		lineNumber: 1,
		columnNumber: 22,
		endLineNumber: 3,
		endColumnNumber: 2,
	}), tokens[2], "Token #2 mismatched" );
}

// Test backslash escapes in strings
{
	reset();
	tokenizer.text('"foo \\\\\\"\\\'\\a\\e\\f\\n\\r\\t\\v"');
	tokenizer.end();

	assertEquals( 2, tokens.length, "Should've found 2 tokens (including the EOF one)" );
	assertEquals( new Token("foo \\\"'\x07\x1B\x0C\n\r\t\x0B", TokenType.DOUBLE_QUOTED, {
		filename: "test",
		lineNumber: 1,
		columnNumber: 1,
		endLineNumber: 1,
		endColumnNumber: 27,
	}), tokens[0], "Escapey token mismatched" );
	
	// TODO: Make it handle \x.. and \u....
}

{
	reset();
	tokenizer.text('# foo bar ');
	tokenizer.text('baz\n#smoosh comment\n42');
	tokenizer.end();
	
	assertEquals( 4, tokens.length, "Should've found 4 tokens (#, #, 42, EOF)" );
	assertEquals( TokenType.COMMENT, tokens[0].type );
	assertEquals( " foo bar baz", tokens[0].text );
	assertEquals( TokenType.COMMENT, tokens[1].type );
	assertEquals( "smoosh comment", tokens[1].text );
	assertEquals( TokenType.BAREWORD, tokens[2].type );
	assertEquals( TokenType.END_OF_FILE, tokens[3].type );
}
