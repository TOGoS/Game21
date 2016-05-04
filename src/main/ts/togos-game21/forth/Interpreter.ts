import KeyedList from '../KeyedList';
import Token, { QuoteType } from './Token';
import { TokenListener } from './Tokenizer';

/*
 * Program memory is logically divided into banks (16k each?)
 * Banks will be physically stored separately and might not actually fill their full address range.
 * High bits of memory locations indicate which bank is being accessed.
 * Any bank may be read/write protected from a given program.
 * A machine may have multiple programs running at once; e.g. a firmware
 * and user program, loaded into separate banks.
 * 
 * Bank 0 = current program's local memory (mapped to another bank)
 * Bank 1 = machine registers.
 * Bank 2 = shared memory for all programs
 * Bank 3 = shared memory for all programs
 * Bank 4 = Firmware bytecode
 * Bank 5 = Firmware local memory
 * Bank 6 = User program bytecode
 * Bank 7 = User program local memory
 * ...etc for any additional programs
 * 
 * Negative addresses may be mapped to address+64 in the 'machine registers' space
 * so that @ and ! instructions can still be just 2 bytes.
 *
 * The stack is a stack of objects.
 * For bytcode programs this will usually be limited to numbers.
 * But interpreters may allow access to more complex data via words.
 * 
 * Byte codes:
 * -64 to +63 (0b10000000 to 0b01111111) are 'push literal number to stack' ops.
 * 0x80 = reserved
 * -- program flow
 * 0x81 : (l) -> () = jump to relative location l
 * 0x82 : (l) -> () = call subroutine at relative location l
 * 0x83 : () -> ()  = return from subroutine
 * 0x84 : (a l) -> () = jump to relative location l if a is nonzero
 * 0x85 : (a l) -> () = jump to relative location l if a is zero
 * -- memory operations
 * 0x88 : (addr -- n) = @byte, a.k.a. fetch [a single signed byte]
 * 0x89 : (addr -- n) = @ubyte, a.k.a. fetch [a single unsigned byte]
 * 0x8A : (n addr --) = !byte, a.k.a. store [a single byte, high bits of n are discarded]
 * -- basic stack ops
 * 0x91 : (a -- a a) = dup
 * 0x92 : (a -- ) = drop
 * 0x93 : (a b -- b a) = swap
 * 0x94 : (a b -- a b a) = over
 * 0x95 : (a b c -- b c a) = rot
 * 0x96 : (a b c -- c b a) = -rot, a.k.a. rot rot
 * 0x97 : (a b -- b) = nip, a.k.a. swap drop
 * 0x98 : (a b -- b a b) = tuck
 * -- numbers
 * 0xA1 : (a b c -- d) = pop 3, push new 21-bit integer
 *        e.g. 1 2 3 0xA1 -> 0b1_0000010_0000011
 *        Upper bit will be extended, so 0xFF 0xFF 0xFF 0xA1 is a verbose way to say -1.
 * 0xA4 : (a b -- a+b) = add
 * 0xA5 : (a b -- a-b) = subtract
 * 0xA6 : (a b -- a*b) = multiply
 * 0xA7 : (a b -- a/b) = divide
 * 0xA8 : (a p -- a**p) = exponentiate
 * 0xAA : (a b -- max(a,b)) = maximum
 * 0xAB : (a b -- max(a,b)) = minimum
 * -- logic
 * 0xBA : (a b -- c) = comparison ; c = -1, 0, or 1
 * 0xBB : (a b -- c) = are equal?
 */

interface ProgramState {
	dataStack:any[];
}

interface BytecodeProgramState extends ProgramState {
	bytecodeRef?:string;
	bytecode?:Int8Array;
	pc:number;
	returnStack:number[];
}

/**
 * Any machine controlled by a program.
 */
interface Machine {
	getRegisterValue(registerId:number):number;
	setRegisterValue(registerId:number, value:number):void;
}

class BytecodeProgramInterpreter {
	public run(state:BytecodeProgramState, machine:Machine, maxSteps:number):BytecodeProgramState {
		// TODO: potentially unfreeze state
		return state;
	}
}

class ProgramBuilder {
	protected bytecode:Int8Array;
	public get endPc():number {
		throw new Error("Not impelmented");
	};
	public relativeOffset(pc:number) {
	}
}

export interface Word {
	evaluate(interpreter:Interpreter):void;
}

export default class Interpreter implements TokenListener {
	public programState:ProgramState = { dataStack: [] };
	public programBuilder:ProgramBuilder = new ProgramBuilder();
	public isCompiling:boolean = false;
	public words:KeyedList<Word>;
	public token(t:Token):void {
		let stack = this.programState.dataStack;
		if( t.quoteType == QuoteType.DOUBLE ) {
			stack.push( t.text );
		} else if( t.text == '+' ) {
			var num1 = +stack.pop();
			var num2 = +stack.pop();
			stack.push( num1 + num2 );
		} else {
			stack.push( parseFloat(t.text) );
		}
	}
	public end():void {
	}
}
