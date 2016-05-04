import Interpreter, {Word} from './Interpreter';
import Tokenizer from './Tokenizer';

function assertEquals( expected:any, actual:any, message:string ):void {
	if( expected !== actual ) throw new Error("Assertion failed; "+expected+" != "+actual+(message ? "; "+message : ''));
}

var interp = new Interpreter();
var tokenizer = new Tokenizer(interp);
tokenizer.sourceLocation({fileUri:'?', lineNumber:1, columnNumber:1});
tokenizer.text("1 2 +");
tokenizer.end();
var top = interp.programState.dataStack.pop();

assertEquals(3, top, "(1 2 +) should result in 3 on top of the stack");
