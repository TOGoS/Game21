import MiniConsole from './MiniConsole';

export default class HTMLConsole implements MiniConsole {
	constructor(public element:HTMLElement) { }
	
	protected push(stuff:any[], className:string="") {
		const p = document.createElement('p');
		p.className = className;
		let isFirst = true;
		for( let t in stuff ) {
			const thing = stuff[t];
			let text:string;
			if( typeof(thing) === 'string' ) {
				text = <string>thing;
			} else if( thing instanceof Error ) {
				text = thing.message;
			} else {
				text = JSON.stringify(thing);
			}
			const span = document.createElement('span');
			if( !isFirst ) {
				p.appendChild(document.createTextNode(" "));
			}
			span.appendChild( document.createTextNode(text) );
			p.appendChild(span);
			isFirst = false;
		}
		this.element.appendChild(p);
		this.element.scrollTop = this.element.scrollHeight; // TODO: only if already at bottom
	}
	
	public log( message?:any, ...optionalParams:any[] ) {
		this.push( [message, ...optionalParams], 'log' );
	}
	public warn( message?:any, ...optionalParams:any[] ) {
		this.push( [message, ...optionalParams], 'warn' );
	}
	public debug( message?:any, ...optionalParams:any[] ) {
		this.push( [message, ...optionalParams], 'debug' );
	}
	public error( message?:any, ...optionalParams:any[] ) {
		this.push( [message, ...optionalParams], 'error' );
	}
}