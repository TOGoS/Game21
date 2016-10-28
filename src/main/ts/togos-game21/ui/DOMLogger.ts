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
	public fragReplacer:(frag:any)=>HTMLElement[]|undefined;
	
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
	public _log(className:string, ...stuff:any[]) {
		const eventElement = this.document.createElement('p');
		eventElement.className = className;
		const texts:string[] = [];
		let first = true;
		for( let t in stuff ) {
			if( !first ) {
				eventElement.appendChild(document.createTextNode(" "));
			}
			let fragElems:HTMLElement[]|undefined;
			if( this.fragReplacer ) {
				fragElems = this.fragReplacer(stuff[t]);
			}
			if( fragElems == null ) {
				const fragElem = this.document.createElement('span');
				fragElem.appendChild(this.document.createTextNode(logStringify(stuff[t])));
				fragElems = [fragElem];
			}
			for( let e in fragElems ) {
				eventElement.appendChild(fragElems[e]);
			}
			first = false;
		}
		this.append(eventElement);
	}
	// TODO: make diff colors or classes something
	public log(...stuff:any[]) { this._log("log", ...stuff); }
	public error(...stuff:any[]) { this._log("error", ...stuff); }
	public warn(...stuff:any[]) { this._log("warning", ...stuff); }
	public debug(...stuff:any[]) { this._log("debug", ...stuff); }
}