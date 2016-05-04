import KeyedList from '../KeyedList';
import Token, { QuoteType } from './Token';
import { TokenListener } from './Tokenizer';

type BytecodeInstruction = number; // More specifically, a number -128 to +127

/*
 * Program memory is logically divided into banks (16k each?)
 * Banks will be physically stored separately and might not actually fill their full address range.
 * High bits of memory locations indicate which bank is being accessed.
 * Any bank may be read/write protected from a given program.
 * A machine may have multiple programs running at once; e.g. a firmware
 * and user program, loaded into separate banks.
 * 
 * Bank 0 = current program's local memory (mapped to another bank)
 * Bank 1 = current program's bytecode (absolute jumps can go into here)
 * Bank 2 = machine registers
 * Bank 3 = shared memory for all programs
 * Bank 4 = Firmware local memory
 * Bank 5 = Firmware bytecode
 * Bank 6 = User program local memory
 * Bank 7 = User program bytecode
 * ...etc for any additional programs
 * 
 * Negative addresses may be mapped to address+64 in the 'machine registers' space
 * so that @ and ! instructions can still be just 2 bytes.
 *
 * The stack is a stack of objects.
 * For bytecode programs this will usually be limited to numbers.
 * But interpreters may allow access to more complex data via words.
 * 
 * For a word suggestion list, see http://lars.nocrew.org/dpans/dpans6.htm#6.1
 *
 * Byte codes:
 * -64 to +63 (0b10000000 to 0b01111111, -0x40 to 0x3F) are 'push literal number to stack' ops.
 * -- program flow
 * 0x40 : noop
 * 0x41 : (l) -> () = jump to relative location l
 * 0x42 : (l) -> () = call subroutine at relative location l
 * 0x43 : () -> ()  = return from subroutine
 * 0x44 : (a l) -> () = jump to relative location l if a is nonzero
 * 0x45 : (a l) -> () = jump to relative location l if a is zero
 * 0x46 : (l) -> () = jump to absolute location l
 * -- memory operations
 * 0x48 : (addr -- n) = @byte, a.k.a. fetch [a single signed byte]
 * 0x49 : (addr -- n) = @ubyte, a.k.a. fetch [a single unsigned byte]
 * 0x4A : (n addr --) = !byte, a.k.a. store [a single byte, high bits of n are discarded]
 * -- basic stack ops
 * 0x51 : (a -- a a) = dup
 * 0x52 : (a -- ) = drop
 * 0x53 : (a b -- b a) = swap
 * 0x54 : (a b -- a b a) = over
 * 0x55 : (a b c -- b c a) = rot
 * 0x56 : (a b c -- c b a) = -rot, a.k.a. rot rot
 * 0x57 : (a b -- b) = nip, a.k.a. swap drop
 * 0x58 : (a b -- b a b) = tuck
 * -- numbers
 * 0x61 : (a b c -- d) = pop 3, push new 21-bit integer
 *        e.g. 1 2 3 0xA1 -> 0b1_0000010_0000011
 *        Upper bit will be extended, so 0xFF 0xFF 0xFF 0xA1 is a verbose way to say -1.
 * 0x64 : (a b -- a+b) = add
 * 0x65 : (a b -- a-b) = subtract
 * 0x66 : (a b -- a*b) = multiply
 * 0x67 : (a b -- a/b) = divide
 * 0x68 : (a p -- a**p) = exponentiate
 * 0x6A : (a b -- max(a,b)) = maximum
 * 0x6B : (a b -- max(a,b)) = minimum
 * -- logic
 * 0x7A : (a b -- c) = comparison ; c = -1, 0, or 1
 * 0x7B : (a b -- c) = are equal?
 * --
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
		// TODO: Load bytecode from cache if state indicates ref instead of actual bytecode
		if( state.bytecode == null ) throw new Error("BytecodeProgramState#bytecode's null");
		const bytecode = state.bytecode;
		
		for( let i=0; i < maxSteps && state.pc >= 0 && state.pc < bytecode.length; ++i ) {
			const inst = bytecode[state.pc];
			if( inst < 0x40 && inst >= -0x40 ) {
				state.dataStack.push(inst);
			}
			var ds = state.dataStack;
			switch( inst & 0xFF ) {
			case 0x64: {
				const n1 = +ds.pop();
				const n0 = +ds.pop();
				ds.push(n0 + n1);
				++state.pc;
				break;
			}
			case 0x65: {
				const n1 = +ds.pop();
				const n0 = +ds.pop();
				ds.push(n0 - n1);
				++state.pc;
				break;
			}
			case 0xFF:
				++state.pc;
				break;
			default:
				throw new Error("Instruction "+inst+" not supported");
			}
		}
		
		return state;
	}
}

class ProgramBuilder {
	protected bytecode:Int8Array = new Int8Array(1024);
	protected length:number = 0;
	public get endPc():number {
		throw new Error("Not impelmented");
	};
	public pushInstruction(instr:number) {
		this.bytecode[this.length++] = instr;
	}
	public pushBytecode(bytecodes:Uint8Array) {
		for( let i=0; i < bytecodes.length; ++i ) {
			// TODO: better
			this.pushInstruction(bytecodes[i]);
		}
	}
	public get currentPosition() {
		return this.length;
	}
	public relativeOffset(pc:number) {
		return pc - this.length;
	}
}

export type Word = (interpreter:Interpreter)=>void;

export function bytecodeWord(bytecode:Int8Array):Word {
	return (interpreter:Interpreter) => {
		if( interpreter.isCompiling ) {
			interpreter.programBuilder.pushBytecode(bytecode);
		} else {
			let ps:BytecodeProgramState = {
				bytecode: bytecode,
				pc: 0,
				dataStack: interpreter.programState.dataStack,
				returnStack: [-1]
			};
			interpreter.bytecodeProgramInterpreter.run(ps, interpreter.machine, Infinity);
		}
	};
}

export function instructionWord(instr:number):Word {
	const bytecode = new Int8Array(1);
	bytecode[0] = instr;
	return bytecodeWord(bytecode);
}

const numRe = /^\d+$/;
export function numberDynamicWord( text:string ):Word {
	if( numRe.exec(text) == null ) return null;
	
	const num = parseFloat(text);
	return (interp:Interpreter) => {
		if( interp.isCompiling ) {
			if( num - Math.floor(num) == 0 && num >= -0x40 && num < 0x40 ) {
				interp.programBuilder.pushInstruction(num);
			} else {
				throw new Error("Can't represent number "+num+" in bytecode."); // well maybe we can later
			}
		} else {
			interp.programState.dataStack.push(num);
		}
	}
}

export const bytecodeInstructions:KeyedList<BytecodeInstruction> = {
	'noop': 0x40,
	'+': 0x64,
	'-': 0x65,
	'exit': 0x43,
};

export const bytecodeWords:KeyedList<Word> = {};
for( let n in bytecodeInstructions ) {
	bytecodeWords[n] = instructionWord(bytecodeInstructions[n]);
};

function encodeNumber(location:number):Int8Array {
	throw new Error("Not implemented yet");
}

function encodeAbsCall(location:number):Int8Array {
	encodeNumber(location);
	throw new Error("Not implemented yet");
}

export const standardCompileWords:KeyedList<Word> = {
	':': (interp:Interpreter) => {
		interp.onToken = (t:Token, interp:Interpreter) => {
			interp.words[t.text] = bytecodeWord(encodeAbsCall(interp.programBuilder.currentPosition));
			interp.isCompiling = true;
			interp.onToken = null;
		};
	},
	';': (interp:Interpreter) => {
		interp.programBuilder.pushInstruction(bytecodeInstructions['exit']),
		interp.isCompiling = false;
	}
}

export default class Interpreter implements TokenListener {
	public programState:ProgramState = { dataStack: [] };
	public programBuilder:ProgramBuilder = new ProgramBuilder();
	public bytecodeProgramInterpreter:BytecodeProgramInterpreter = new BytecodeProgramInterpreter();
	public machine:Machine;
	public isCompiling:boolean = false;
	public onToken:(t:Token, interp:Interpreter)=>void;
	public words:KeyedList<Word> = {};
	public dynamicWords:KeyedList<(text:string)=>Word> = {}
	
	public token(t:Token):void {
		if( this.onToken ) {
			this.onToken(t, this);
			return;
		}
		
		let stack = this.programState.dataStack;
		if( t.quoteType == QuoteType.DOUBLE ) {
			if( this.isCompiling ) {
				throw new Error("Can't compile string");
			}
			stack.push( t.text );
			return;
		}
		if( this.words[t.text] ) {
			this.words[t.text](this);
			return;
		}
		for( let p in this.dynamicWords ) {
			let dw = this.dynamicWords[p];
			let w = dw( t.text );
			if( w ) {
				w(this);
				return;
			}
		}
		throw new Error("Unrecognized word: '"+t.text+"'");
	}
	public end():void {
	}
	
	public defineWords(words:KeyedList<Word>):void {
		for( let n in words ) {
			this.words[n] = words[n];
		}
	}
}
