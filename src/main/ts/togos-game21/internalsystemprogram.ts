import SourceLocation from './lang/SourceLocation';
import KeyedList from './KeyedList';

interface BaseExpression {
	classRef : string;
	sourceLocation? : SourceLocation;
}

/// TOGVM-defined expressions

export interface LiteralString extends BaseExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/LiteralString";
	literalValue : string;
}
export interface LiteralNumber extends BaseExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/LiteralNumber";
	literalValue : number;
}
export interface LiteralBoolean extends BaseExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/LiteralBoolean";
	literalValue : boolean;
}
export interface VariableExpression extends BaseExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/Variable";
	variableName : string;
}
export interface LetExpression extends BaseExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/Let";
	variableValueExpressions : KeyedList<BaseExpression>
}
export interface FunctionApplication extends BaseExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/FunctionApplication";
	functionRef? : FunctionRef;
	functionExpression? : ProgramExpression;
	arguments : ProgramExpression[];
}
export interface ArrayConstructionExpression extends BaseExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/ArrayConstruction";
	values : ProgramExpression[];
}
export interface IfElseExpression extends BaseExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/IfElseChain";
	arguments : ProgramExpression[];
}

export type ProgramExpression =
	LiteralString|LiteralNumber|LiteralBoolean|
	VariableExpression|LetExpression|FunctionApplication|
	ArrayConstructionExpression|
	IfElseExpression;

export type FunctionRef =
	"http://ns.nuke24.net/TOGVM/Functions/AreEqual" |
	"http://ns.nuke24.net/TOGVM/Functions/AreNotEqual" |
	"http://ns.nuke24.net/TOGVM/Functions/Coalesce" |
	"http://ns.nuke24.net/TOGVM/Functions/BooleanNegate" |
	"http://ns.nuke24.net/InternalSystemFunctions/SendBusMessage" |
	"http://ns.nuke24.net/InternalSystemFunctions/EntityClassRef" |
	"http://ns.nuke24.net/InternalSystemFunctions/ProgN" |
	"http://ns.nuke24.net/InternalSystemFunctions/Trace" |
	"http://ns.nuke24.net/InternalSystemFunctions/GetEntityStateVariable" |
	"http://ns.nuke24.net/InternalSystemFunctions/SetEntityStateVariable";

export const FUNC_SEND_BUS_MESSAGE = "http://ns.nuke24.net/InternalSystemFunctions/SendBusMessage";
export const FUNC_ENTITY_CLASS_REF = "http://ns.nuke24.net/InternalSystemFunctions/EntityClassRef";

const shortToLongFunctionRefs:KeyedList<FunctionRef> = {
	"!": "http://ns.nuke24.net/TOGVM/Functions/BooleanNegate",
	"!=": "http://ns.nuke24.net/TOGVM/Functions/AreNotEqual",
	"=": "http://ns.nuke24.net/TOGVM/Functions/AreEqual",
	"coalesce": "http://ns.nuke24.net/TOGVM/Functions/Coalesce",
	"sendBusMessage": "http://ns.nuke24.net/InternalSystemFunctions/SendBusMessage",
	"progn": "http://ns.nuke24.net/InternalSystemFunctions/ProgN",
	"trace": "http://ns.nuke24.net/InternalSystemFunctions/Trace",
	"gesv": "http://ns.nuke24.net/InternalSystemFunctions/GetEntityStateVariable",
	"sesv": "http://ns.nuke24.net/InternalSystemFunctions/SetEntityStateVariable",
};

export function sExpressionToProgramExpression(x:any):ProgramExpression {
	if( typeof x == 'string' ) {
		return <LiteralString>{
			classRef: "http://ns.nuke24.net/TOGVM/Expressions/LiteralString",
			literalValue: x
		};
	} else if( typeof x == 'number' ) {
		return <LiteralNumber>{
			classRef: "http://ns.nuke24.net/TOGVM/Expressions/LiteralNumber",
			literalValue: x
		};
	} else if( typeof x == 'boolean' ) {
		return <LiteralBoolean>{
			classRef: "http://ns.nuke24.net/TOGVM/Expressions/LiteralBoolean",
			literalValue: x
		};
	} else if( Array.isArray(x) ) {
		if( x.length == 0 ) throw new Error("S-expression is zero length, which is bad!"); // Unless I decide it means Nil.
		
		if( Array.isArray(x[0]) ) {
			const funkargs:ProgramExpression[] = [];
			for( let i=1; i<x.length; ++i ) {
				funkargs.push(sExpressionToProgramExpression(x[i]));
			}
			return <FunctionApplication>{
				classRef: "http://ns.nuke24.net/TOGVM/Expressions/FunctionApplication",
				functionExpression: sExpressionToProgramExpression(x[0]),
				arguments: funkargs
			};
		}
		
		switch( x[0] ) {
		case 'if':
			{
				const componentExpressions:ProgramExpression[] = [];
				for( let i=1; i<x.length; ++i ) {
					componentExpressions.push( sExpressionToProgramExpression(x[i]) );
				}
				return <IfElseExpression>{
					classRef: "http://ns.nuke24.net/TOGVM/Expressions/IfElseChain",
					arguments: componentExpressions
				};
			}
		case 'makeArray':
			{
				const componentExpressions:ProgramExpression[] = [];
				for( let i=1; i<x.length; ++i ) {
					componentExpressions.push( sExpressionToProgramExpression(x[i]) );
				}
				return <ArrayConstructionExpression>{
					classRef: "http://ns.nuke24.net/TOGVM/Expressions/ArrayConstruction",
					values: componentExpressions
				};
			}
		case 'var':
			{
				if( x.length != 2 ) throw new Error("Var expression requires exactly one argument; gave: "+JSON.stringify(x));
				if( typeof x[1] != 'string' ) {
					throw new Error("Oh no var name must be a literal string, not "+JSON.stringify(x[1]));
				}
				return <VariableExpression>{
					classRef: "http://ns.nuke24.net/TOGVM/Expressions/Variable",
					variableName: x[1],
				};
			}
		}
		
		if( shortToLongFunctionRefs[x[0]] ) {
			const argumentExpressions:ProgramExpression[] = [];
			for( let i=1; i<x.length; ++i ) {
				argumentExpressions.push( sExpressionToProgramExpression(x[i] ) );
			}
			return <FunctionApplication>{
				classRef: "http://ns.nuke24.net/TOGVM/Expressions/FunctionApplication",
				functionRef: shortToLongFunctionRefs[x[0]],
				arguments: argumentExpressions
			};
		}
		
		throw new Error("Unrecognized function '"+x[0]+"'");
	}
	
	throw new Error("I can't compile this :( "+JSON.stringify(x));
}
