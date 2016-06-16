import SourceLocation from './SourceLocation';

interface SourceSpan extends SourceLocation {
	fileUri : string;
	lineNumber : number;
	columnNumber : number;
	// 'end' gives the point after the last character
	endLineNumber : number;
	endColumnNumber : number;
}

export default SourceSpan;
