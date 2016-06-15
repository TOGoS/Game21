import KeyedList from '../KeyedList';
import Token, { TokenType } from './Token';
import { TokenListener } from './Tokenizer';

type BytecodeInstruction = number; // More specifically, a number -128 to +127

/*
 * TODO: Separate segment registers for program, data, stacks
 * so that most jumps, memory access, etc, can be near zero.
 * 
 * Program memory is logically divided into banks (65k each?)
 * Banks will be physically stored separately and might not actually fill their full address range.
 * High bits of memory locations indicate which bank is being accessed.
 * Any bank may be read/write protected from a given program.
 * A machine may have multiple programs running at once; e.g. a firmware
 * and user program, loaded into separate banks.
 * 
 * Bank  0 = current program's local memory (mapped to another bank)
 * Bank  1 = current program's bytecode (absolute jumps can go into here and be mapped to the current program's bank)
 * Bank  2 = machine registers
 * Bank  3 = machine routines (i.e. fake bytecode space to call into)
 * Bank  4..7 = shared memory for all programs
 * Bank  8 = Firmware local memory
 * Bank  9 = Firmware bytecode
 * Bank 10 = User program local memory
 * Bank 11 = User program bytecode
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
 * 0x47 : (l) -> () = call subroutine at absolute location l
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
 * 0x59
 * 0x5A : (a -- ) = >r = pop from data stack onto return stack
 * 0x5B : (-- a) = pop from return stack onto data stack
 * -- numbers
 * 0x60 : (a b -- c) = (a << 7) | b
 * 0x61 : (a b c -- d) = (a << 14) | (b << 7) | c
 *        push new 21-bit integer
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

export const INTRABANK_BITS = 16;
export const BANK_SIZE      = 1<<INTRABANK_BITS;
export const INTRABANK_MASK = 0x00FFFF;
export const BANK_MASK      = 0xFF0000;

interface ProgramState {
	dataStack:any[];
}

interface DataBank {
	isWritable:boolean;
	isExecutable:boolean;
	dataRef?:string;
	data?:Int8Array;
}

interface BytecodeProgramState extends ProgramState {
	pc:number;
	returnStack:number[];
}

/**
 * Any machine controlled by a program.
 */
interface Machine {
	dataBanks:DataBank[];
	getRegisterValue(registerId:number):number;
	setRegisterValue(registerId:number, value:number):void;
}

/**
 * Component to run programs.
 * Does not store any program state itself
 */
class BytecodeProgramInterpreter {
	protected doAbsJmp(loc:number, state:BytecodeProgramState):BytecodeProgramState {
		//state = thaw(state);
		const bankId = (loc >> INTRABANK_BITS);
		if( bankId == 1 ) {
			loc = (state.pc & BANK_MASK) | (loc & INTRABANK_MASK);
		}
		state.pc = loc;
		return state;
	}
	
	public doInstruction(inst:number, state:BytecodeProgramState, machine:Machine, banks:DataBank[]):BytecodeProgramState {
		if( inst < 0x40 && inst >= -0x40 ) {
			state.dataStack.push(inst);
			++state.pc;
			return state;
		}
		var ds = state.dataStack;
		switch( inst & 0xFF ) {
		case 0x40:
			++state.pc;
			return state;
		case 0x43: // return
			return this.doAbsJmp(+state.returnStack.pop(), state); 
		case 0x46: // absolute jump
			return this.doAbsJmp(ds.pop(), state);
		case 0x47: // absolute call
			state.returnStack.push(state.pc+1);
			return this.doAbsJmp(ds.pop(), state);
		
		case 0x5A:
			state.returnStack.push(state.dataStack.pop());
			++state.pc;
			return state;
		case 0x5B:
			state.dataStack.push(state.returnStack.pop());
			++state.pc;
			return state;
		
		case 0x60: { // make 14-bit number
			const n0 = +ds.pop();
			const n7 = (ds.pop() & 0x7F);
			ds.push((n7 << 7) | n0);
			++state.pc;
			return state;
		}
		case 0x61: { // make 21-bit number
			const n0  = +ds.pop();
			const n7  = (ds.pop() & 0x7F);
			const n14 = (ds.pop() & 0x7F);
			ds.push((n14 << 14 ) | (n7 << 7) | n0);
			++state.pc;
			return state;
		}
		case 0x64: {
			const n1 = +ds.pop();
			const n0 = +ds.pop();
			ds.push(n0 + n1);
			++state.pc;
			return state;
		}
		case 0x65: {
			const n1 = +ds.pop();
			const n0 = +ds.pop();
			ds.push(n0 - n1);
			++state.pc;
			return state;
		}
		default:
			throw new Error("Instruction 0x"+inst.toString(16)+" not supported");
		}
	}
	
	public run(state:BytecodeProgramState, machine:Machine, banks:DataBank[], maxSteps:number):BytecodeProgramState {
		// TODO: potentially unfreeze state
		// TODO: Load bytecode from cache if state indicates ref instead of actual bytecode
		
		for( let i=0; i < maxSteps && state.pc >= 0; ++i ) {
			const bankId = (state.pc >> INTRABANK_BITS);
			const position = (state.pc & INTRABANK_MASK);
			const bank = banks[bankId];
			if( !bank.isExecutable ) throw new Error("Bank "+bankId+" not executable!");
			let bytecode = bank.data;
			if( position >= bytecode.length ) throw new Error("Ran off bytecode end: "+position);
			const inst = bytecode[position];
			state = this.doInstruction(inst, state, machine, banks);
		}
		
		return state;
	}
}

export class ProgramBuilder {
	protected length:number = 0;
	public constructor(public bytecode:Int8Array, public bankAddress:number) { }
	
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
		return this.bankAddress + this.length;
	}
	public relativeOffset(pc:number) {
		return pc - this.length;
	}
}

export type Word = (interpreter:Interpreter)=>void;

export function instructionWord(instruction:BytecodeInstruction):Word {
	return (interpreter:Interpreter) => {
		if( interpreter.isCompiling ) {
			interpreter.programBuilder.pushInstruction(instruction);
		} else {
			interpreter.bytecodeProgramInterpreter.doInstruction(
				instruction,
				interpreter.programState,
				interpreter.machine,
				interpreter.machine.dataBanks
			);
		}
	};
}

export function bytecodeCallWord(target:number):Word {
	return (interpreter:Interpreter) => {
		if( interpreter.isCompiling ) {
			interpreter.programBuilder.pushBytecode(encodeAbsCall(target));
		} else {
			interpreter.programState.returnStack.push(-1);
			interpreter.programState.pc = target;
			interpreter.bytecodeProgramInterpreter.run(
				interpreter.programState,
				interpreter.machine,
				interpreter.machine.dataBanks,
				Infinity
			);
		}
	};
}

function singleInstructionBytecode(instr:number):Int8Array {
	const bytecode = new Int8Array(1);
	bytecode[0] = instr;
	return bytecode;
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
	'>r': 0x5A,
	'r>': 0x5B,
	'+': 0x64,
	'-': 0x65,
	'exit': 0x43,
};

export const bytecodeWords:KeyedList<Word> = {};
for( let n in bytecodeInstructions ) {
	bytecodeWords[n] = instructionWord(bytecodeInstructions[n]);
};

function _encodeNumber(n:number, buf:Int8Array, offset:number):number {
	let septets = 1;
	for( let m=n; m >= 0x40 || m < -0x40; m >>= 7, ++septets );
	if( septets == 1 ) {
		if( buf != null ) buf[0] = n;
		return 1;
	} else if( septets == 2 ) {
		if( buf ) {
			buf[offset]   = ((n >> 7) & 0x7F);
			buf[offset+1] = ( n       & 0x7F);
			buf[offset+2] = 0x60;
		}
		return 3;
	} else if( septets == 3 ) {
		if( buf ) {
			buf[offset]   = ((n >> 14) & 0x7F);
			buf[offset+1] = ((n >>  7) & 0x7F);
			buf[offset+2] = ( n        & 0x7F);
			buf[offset+3] = 0x61;
		}
		return 4;
	} else {
		const highSize = _encodeNumber( n >> 21, buf, offset );
		const lowSize  = _encodeNumber( n      , buf, offset+highSize );
		if( highSize + lowSize > 10 ) throw new Error("Something went wrong when determining encoded number size; "+highSize+", "+lowSize);
		return highSize + lowSize;
	}
}

function encodedNumberSize(n:number):number {
	return _encodeNumber(n, null, 0);
}

function encodeNumber(n:number):Int8Array {
	const size  = encodedNumberSize(n);
	const codes = new Int8Array(size);
	_encodeNumber(n, codes, 0);
	return codes;
}

function encodeAbsCall(n:number, buf:Int8Array=null, offset:number=0):Int8Array {
	if( buf == null ) {
		const size = encodedNumberSize(n) + 1;
		buf = new Int8Array(size);
	}
	offset += _encodeNumber(n, buf, offset);
	buf[offset] = 0x47;
	return buf;
}

export const standardCompileWords:KeyedList<Word> = {
	':': (interp:Interpreter) => {
		interp.onToken = (t:Token, interp:Interpreter) => {
			interp.words[t.text] = bytecodeCallWord(interp.programBuilder.currentPosition);
			interp.isCompiling = true;
			interp.onToken = null;
		};
	},
	';': (interp:Interpreter) => {
		interp.programBuilder.pushInstruction(bytecodeInstructions['exit']);
		interp.isCompiling = false;
	}
}

export default class Interpreter implements TokenListener {
	public programState:BytecodeProgramState = {
		pc: 0,
		dataStack: [],
		returnStack: [],
	};
	public programBuilder:ProgramBuilder;
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
		if( t.type == TokenType.DOUBLE_QUOTED ) {
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
