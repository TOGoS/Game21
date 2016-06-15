interface SourceSpan {
	fileUri : string;
	// 'start' gives the point before the first character.  1 is still 0, though.
	startLineNumber : number;
	startColumnNumber : number;
	// 'end' gives the point after the last character
	endLineNumber : number;
	endColumnNumber : number;
}

export default SourceSpan;
