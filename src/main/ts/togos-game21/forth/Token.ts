import SourceSpan from './SourceSpan.ts';

export enum TokenType {
	BAREWORD,
	SINGLE_QUOTED,
	DOUBLE_QUOTED,
	COMMENT,
	END_OF_FILE
}

export default class Token {
	constructor(public text:string, public type:TokenType, public sourceLocation:SourceSpan) { }
}
