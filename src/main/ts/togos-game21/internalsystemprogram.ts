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
	valueExpressions : ProgramExpression[];
}
export interface AssociativeArrayConstructionExpression extends BaseExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/AssociativeArrayConstruction";
	pairExpressions : ProgramExpression[];
}
export interface IfElseExpression extends BaseExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/IfElseChain";
	arguments : ProgramExpression[];
}
export interface SplatExpression extends BaseExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/Splat";
	valueExpression : ProgramExpression[];
}

export type ProgramExpression =
	LiteralString|LiteralNumber|LiteralBoolean|
	VariableExpression|LetExpression|FunctionApplication|
	ArrayConstructionExpression|
	AssociativeArrayConstructionExpression|
	IfElseExpression|
	SplatExpression;

export type FunctionRef =
	"http://ns.nuke24.net/TOGVM/Functions/AreEqual" |
	"http://ns.nuke24.net/TOGVM/Functions/AreNotEqual" |
	"http://ns.nuke24.net/TOGVM/Functions/Coalesce" |
	"http://ns.nuke24.net/TOGVM/Functions/BooleanNegate" |
	"http://ns.nuke24.net/Game21/InternalSystemFunctions/SendBusMessage" |
	"http://ns.nuke24.net/Game21/InternalSystemFunctions/EntityClassRef" |
	"http://ns.nuke24.net/Game21/InternalSystemFunctions/ProgN" |
	"http://ns.nuke24.net/Game21/InternalSystemFunctions/Trace" |
	"http://ns.nuke24.net/Game21/InternalSystemFunctions/GetEntityStateVariable" |
	"http://ns.nuke24.net/Game21/InternalSystemFunctions/SetEntityStateVariable";

export const FUNC_SEND_BUS_MESSAGE = "http://ns.nuke24.net/InternalSystemFunctions/SendBusMessage";
export const FUNC_ENTITY_CLASS_REF = "http://ns.nuke24.net/InternalSystemFunctions/EntityClassRef";

const shortToLongFunctionRefs:KeyedList<FunctionRef> = {
	"!": "http://ns.nuke24.net/TOGVM/Functions/BooleanNegate",
	"!=": "http://ns.nuke24.net/TOGVM/Functions/AreNotEqual",
	"=": "http://ns.nuke24.net/TOGVM/Functions/AreEqual",
	"coalesce": "http://ns.nuke24.net/TOGVM/Functions/Coalesce",
	"sendBusMessage": "http://ns.nuke24.net/Game21/InternalSystemFunctions/SendBusMessage",
	"progn": "http://ns.nuke24.net/Game21/InternalSystemFunctions/ProgN",
	"trace": "http://ns.nuke24.net/Game21/InternalSystemFunctions/Trace",
	"gesv": "http://ns.nuke24.net/Game21/InternalSystemFunctions/GetEntityStateVariable",
	"sesv": "http://ns.nuke24.net/Game21/InternalSystemFunctions/SetEntityStateVariable",
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
					valueExpressions: componentExpressions
				};
			}
		case 'makeAssociativeArray':
			{
				const componentExpressions:ProgramExpression[] = [];
				for( let i=1; i<x.length; ++i ) {
					componentExpressions.push( sExpressionToProgramExpression(x[i]) );
				}
				return <AssociativeArrayConstructionExpression>{
					classRef: "http://ns.nuke24.net/TOGVM/Expressions/AssociativeArrayConstruction",
					pairExpressions: componentExpressions
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

export interface StandardEvaluationContext {
	variableValues: KeyedList<any>;
	functions: KeyedList<(this:this, ...args:any[]) => any>;
}

export function evaluateExpression<Context extends StandardEvaluationContext>(
	expression:ProgramExpression, ctx:Context
):any {
	switch( expression.classRef ) {
	case "http://ns.nuke24.net/TOGVM/Expressions/LiteralString":
	case "http://ns.nuke24.net/TOGVM/Expressions/LiteralNumber":
	case "http://ns.nuke24.net/TOGVM/Expressions/LiteralBoolean":
		return expression.literalValue;
	case "http://ns.nuke24.net/TOGVM/Expressions/ArrayConstruction":
		{
			const argValues:any[] = [];
			for( let i=0; i<expression.valueExpressions.length; ++i ) {
				const valExp = expression.valueExpressions[i];
				if( valExp.classRef == "http://ns.nuke24.net/TOGVM/Expressions/Splat" ) {
					const toSlurp = evaluateExpression(valExp, ctx);
					for( let k in toSlurp ) argValues.push(toSlurp[k]);
				} else {
					argValues.push(evaluateExpression(valExp, ctx));
				}
			}
			return argValues;
		}
	case "http://ns.nuke24.net/TOGVM/Expressions/AssociativeArrayConstruction":
		{
			const argValues:any = {};
			for( let i=0; i<expression.pairExpressions.length; ++i ) {
				const keyExp = expression.pairExpressions[i];
				if( keyExp.classRef == "http://ns.nuke24.net/TOGVM/Expressions/Splat" ) {
					const toSlurp = evaluateExpression(keyExp, ctx);
					for( let k in toSlurp ) argValues[k] = toSlurp[k];
				} else {
					const valExp = expression.pairExpressions[++i];
					const key = evaluateExpression(keyExp, ctx);
					argValues[key] = evaluateExpression(valExp, ctx);
				}
			}
			return argValues;
		}
	case "http://ns.nuke24.net/TOGVM/Expressions/Variable":
		return ctx.variableValues[expression.variableName];
	case "http://ns.nuke24.net/TOGVM/Expressions/IfElseChain":
		{
			if( (expression.arguments.length % 2) != 1 ) {
				throw new Error("IfElseChain must have an odd number of arguments!  Got "+expression.arguments.length);
			}
			for( let i=0; i<expression.arguments.length-2; i += 2 ) {
				const useThisOne = evaluateExpression(expression.arguments[i], ctx);
				if( useThisOne ) return evaluateExpression(expression.arguments[i+1], ctx);
			}
			return evaluateExpression(expression.arguments[expression.arguments.length-1], ctx);
		}
	case "http://ns.nuke24.net/TOGVM/Expressions/FunctionApplication":
		{
			const argValues:any[] = [];
			for( let i=0; i<expression.arguments.length; ++i ) {
				argValues.push(evaluateExpression(expression.arguments[i], ctx));
			}
			if( !expression.functionRef && expression.functionExpression ) {
				let thing = evaluateExpression(expression.functionExpression, ctx);
				// For now just assume it's array element lookups
				for( let i=0; thing != undefined && i<argValues.length; ++i ) {
					const key = argValues[i];
					thing = thing[key];
				}
				return thing;
			}
			
			const func = ctx.functions[<string>expression.functionRef];
			if( func ) {
				return func.apply(ctx, argValues);
			} else {
				throw new Error("Call to unsupported function "+expression.functionRef);
			}
		}
	default:
		throw new Error(
			"Dunno how to evaluate expression class camp town ladies sing this song, do da, do da, "+
			"camp town race track five miles long, oh da do da day: "+expression.classRef);
	}
}

export const standardFunctions:KeyedList<(...argValues:any[])=>any> = {
	"http://ns.nuke24.net/TOGVM/Functions/AreEqual": (...argValues:any[]) => {
		for( let i=1; i<argValues.length; ++i ) {
			if( argValues[i] != argValues[0] ) return false;
		}
		return true;
	},
	"http://ns.nuke24.net/TOGVM/Functions/AreNotEqual": (...argValues:any[]) => {
		for( let i=1; i<argValues.length; ++i ) {
			if( argValues[i] != argValues[0] ) return true;
		}
		return false;
	},
	"http://ns.nuke24.net/TOGVM/Functions/BooleanNegate": (v:any) => !v,
	"http://ns.nuke24.net/TOGVM/Functions/Coalesce": (...argValues:any[]) => {
		for( let i in argValues ) {
			if( argValues[i] != undefined ) return argValues[i];
		}
		return undefined;
	},
	"http://ns.nuke24.net/Game21/InternalSystemFunctions/Trace": () => {
		//const logFunc = console.debug || console.log;
		//logFunc.call(console, "Trace from entity subsystem program", argValues, ctx);
	},
	"http://ns.nuke24.net/Game21/InternalSystemFunctions/ProgN": (...argValues:any[]) => {
		return argValues.length == 0 ? undefined : argValues[argValues.length-1];
	},
};
