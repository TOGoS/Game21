import Interpreter, {ProgramBuilder, INTRABANK_BITS, Word, numberDynamicWord, bytecodeWords, standardCompileWords} from './Interpreter';
import Tokenizer from '../lang/Tokenizer';

function assertEquals( expected:any, actual:any, message:string ):void {
	if( expected !== actual ) throw new Error("Assertion failed; "+expected+" != "+actual+(message ? "; "+message : ''));
}

function evalu(source:string):any {
	var interp = new Interpreter();
	interp.machine = {
		getRegisterValue: (regId:number) => 0,
		setRegisterValue: (regId:number, value:number) => 0,
		dataBanks: [
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				isWritable: true,
				isExecutable: false,
				data: new Int8Array(1024),
			},
			{
				isWritable: false,
				isExecutable: true,
				data: new Int8Array(1024),
			},
		]
	}
	interp.programBuilder = new ProgramBuilder(
		interp.machine.dataBanks[11]!.data!,
		11 << INTRABANK_BITS
	);
	interp.dynamicWords['number'] = numberDynamicWord;
	interp.defineWords(bytecodeWords);
	interp.defineWords(standardCompileWords);
	var tokenizer = new Tokenizer(interp.token.bind(interp));
	tokenizer.sourceLocation = {filename:'?', lineNumber:1, columnNumber:1};
	tokenizer.text(source);
	tokenizer.end();
	return interp.programState.dataStack.pop();	
}

function assertEvalu(expectedValue:any, source:string):void {
	var value = evalu(source);
	assertEquals(expectedValue, value, "("+source+") should have left "+expectedValue+" on top of the stack; got "+value);
}

assertEvalu(3, "1 2 +");

assertEvalu(6, ": add3 + + ; 1 2 3 add3");

assertEvalu(21, ": add3 + + ; : add6 add3 >r add3 r> + ; 1 2 3 4 5 6 add6")
