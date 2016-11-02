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
	functionExpression? : BaseExpression;
	arguments : ProgramExpression[];
}
export interface ArrayConstructionExpression extends BaseExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/ArrayConstruction";
	values : ProgramExpression[];
}

export type ProgramExpression =
	LiteralString|LiteralNumber|LiteralBoolean|
	VariableExpression|LetExpression|FunctionApplication|
	ArrayConstructionExpression;

export type FunctionRef = 
	"http://ns.nuke24.net/InternalSystemFunctions/SendBusMessage" |
	"http://ns.nuke24.net/InternalSystemFunctions/EntityClassRef";

export const FUNC_SEND_BUS_MESSAGE = "http://ns.nuke24.net/InternalSystemFunctions/SendBusMessage";
export const FUNC_ENTITY_CLASS_REF = "http://ns.nuke24.net/InternalSystemFunctions/EntityClassRef";
