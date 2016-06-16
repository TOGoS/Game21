import KeyedList from '../KeyedList';
import Token from './Token';
import Tokenizer from './Tokenizer';
import Interpreter, { Word, SynchronousRuntimeWord, STANDARD_RESULT_PROMISE } from './Interpreter2';

function assertEquals( a:any, b:any, message?:string ) {
	const aJson = JSON.stringify(a);
	const bJson = JSON.stringify(b);
	if( aJson !== bJson ) {
		throw new Error("Assertion failed: "+aJson+" != "+bJson+(message ? "; "+message : ""));
	}
}

const add = new SynchronousRuntimeWord('+', (interp,thread) => {
	let b = thread.dataStack.pop();
	let a = thread.dataStack.pop();
	thread.dataStack.push( a + b );
});
const subtract = new SynchronousRuntimeWord('-', (interp,thread) => {
	let b = thread.dataStack.pop();
	let a = thread.dataStack.pop();
	thread.dataStack.push( a - b );
});
const dup = new SynchronousRuntimeWord('dup', (interp,thread) => {
	let a = thread.dataStack.pop();
	thread.dataStack.push(a);
	thread.dataStack.push(a);
});
const drop = new SynchronousRuntimeWord('drop', (interp,thread) => {
	thread.dataStack.pop();
});
const swap = new SynchronousRuntimeWord('swap', (interp,thread) => {
	let b = thread.dataStack.pop();
	let a = thread.dataStack.pop();
	thread.dataStack.push(b);
	thread.dataStack.push(a);
});
const concat = new SynchronousRuntimeWord('concat', (interp,thread) => {
	let b = thread.dataStack.pop();
	let a = thread.dataStack.pop();
	thread.dataStack.push(a + "" + b);
});

const words:KeyedList<Word> = {
	'+': add,
	'-': subtract,
	'dup': dup,
	'drop': drop,
	'swap': swap,
	'concat': concat,
}

function assertStackAfter( expectedStack:any[], script:string ) {
	const interpreter = new Interpreter();
	interpreter.defineWords( words );

	const tokenizer = new Tokenizer(interpreter);
	tokenizer.text(script);
	tokenizer.end();
	
	assertEquals( expectedStack, interpreter.threads[0].dataStack );
}

assertStackAfter( [3], "1 2 +" );
assertStackAfter( ['Hello'], '"Hello"' );
assertStackAfter( [2, 1], "1 2 swap" );
assertStackAfter( ["barfoo"], '"foo" "bar" swap concat' );
