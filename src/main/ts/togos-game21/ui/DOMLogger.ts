import Logger from '../Logger';

function logStringify(thing:any):string {
	if( typeof(thing) == 'string' ) return thing;
	if( typeof(thing) == 'number' ) return ""+thing;
	if( typeof(thing) == 'boolean' ) return thing ? 'true' : 'false';
	if( typeof(thing) == 'undefined' ) return 'undefined';
	if( typeof(thing) == 'null' ) return 'null';
	return JSON.stringify(thing, null, "\t");
}

export default class DOMLogger implements Logger {
	public document:HTMLDocument;
	public outputElement:HTMLElement;
	
	public constructor( outputElem:HTMLElement ) {
		this.outputElement = outputElem;
		this.document = outputElem.ownerDocument;
	}

	protected append( elem:HTMLElement ) {
		var wasAtBottom = this.outputElement.scrollTop == (this.outputElement.scrollHeight - this.outputElement.clientHeight);
		this.outputElement.appendChild(elem);
		if( wasAtBottom ) {
			this.outputElement.scrollTop = this.outputElement.scrollHeight - this.outputElement.clientHeight;
		}
	}
	
	public printLine(fh:number, text:string) {
		const line = this.document.createElement('p');
		line.appendChild(document.createTextNode(text));
		this.append(line);
	}
	public log(...stuff:any[]) {
		const pre = this.document.createElement('pre');
		const texts:string[] = [];
		for( let t in stuff ) {
			texts.push(logStringify(stuff[t]));
		}
		pre.appendChild(document.createTextNode(texts.join(" ")));
		this.append(pre);
	}
	// TODO: make diff colors or classes something
	public error(...stuff:any[]) { this.log(...stuff); }
	public warn(...stuff:any[]) { this.log(...stuff); }
	public debug(...stuff:any[]) { this.log(...stuff); }
}