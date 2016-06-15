import SourceSpan from './SourceSpan';

export enum TokenType {
	BAREWORD,
	SINGLE_QUOTED,
	DOUBLE_QUOTED,
	COMMENT
}

export default class Token {
	constructor(public text:string, public type:TokenType, public sourceSpan:SourceSpan) { }
	
	public get sourceLocation() {
		return {
			fileUri: this.sourceSpan.fileUri,
			lineNumber: this.sourceSpan.startLineNumber,
			columnNumber: this.sourceSpan.startColumnNumber
		}
	}
}
