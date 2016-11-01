import SourceLocation from './SourceLocation';

// Note that this is compatible with TOGVM SourceLocations.
// Don't go renaming fields without that in mind.

interface SourceSpan extends SourceLocation {
	filename : string;
	lineNumber : number;
	columnNumber : number;
	// 'end' gives the point after the last character
	endLineNumber : number;
	endColumnNumber : number;
}

export default SourceSpan;
