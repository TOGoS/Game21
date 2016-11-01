import SourceLocation from './lang/SourceLocation';
import KeyedList from './KeyedList';

export interface ProgramExpression {
	classRef : string;
	sourceLocation? : SourceLocation;
}

/// TOGVM-defined expressions

export interface LiteralString extends ProgramExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/LiteralString";
	literalValue : string;
}
export interface LiteralNumber extends ProgramExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/LiteralNumber";
	literalValue : number;
}
export interface LiteralBoolean extends ProgramExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/LiteralBoolean";
	literalValue : number;
}
export interface VariableExpression extends ProgramExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/Variable";
	variableName : string;
}
export interface LetExpression extends ProgramExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/Let";
	variableValueExpressions : KeyedList<ProgramExpression>
}
export interface FunctionApplication extends ProgramExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/FunctionApplication";
	functionRef? : string;
	functionExpression? : ProgramExpression;
}
export interface ArrayConstructionExpression extends ProgramExpression {
	classRef : "http://ns.nuke24.net/TOGVM/Expressions/ArrayConstruction";
	values : ProgramExpression[];
}

const FUNC_SEND_BUS_MESSAGE = "http://ns.nuke24.net/InternalSystemFunctions/SendBusMessage";
const FUNC_ENTITY_CLASS_REF = "http://ns.nuke24.net/InternalSystemFunctions/EntityClassRef";
