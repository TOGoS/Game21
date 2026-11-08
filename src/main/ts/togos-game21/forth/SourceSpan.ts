import SourceLocation from './SourceLocation.ts';

interface SourceSpan extends SourceLocation {
	fileUri : string;
	lineNumber : number;
	columnNumber : number;
	// 'end' gives the point after the last character
	endLineNumber : number;
	endColumnNumber : number;
}

export default SourceSpan;
