interface SourceLocation {
	fileUri : string;
	lineNumber : number; // 1 being the first line in the file
	columnNumber : number; // also 1-based, contrary to how emacs does it
}

export default SourceLocation;
