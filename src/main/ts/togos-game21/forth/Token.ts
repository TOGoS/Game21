import SourceLocation from './SourceLocation';

export enum QuoteType {
	BAREWORD,
	SINGLE,
	DOUBLE
}

export default class Token {
	constructor(public text:string, public quoteType:QuoteType, public sourceLocation:SourceLocation) { }
}
