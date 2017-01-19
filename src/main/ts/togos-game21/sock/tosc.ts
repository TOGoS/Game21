/**
 * Text-osc encoding/decoding.
 * 
 * TODO: Use Tokenizer so that quoted strings can be supported.
 */

type OSCMessage = any[]; // First element should be a string, but TS can't represent that AFAIK

const dataRegex = /^data:(base64)?,(.*)$/;
const stringRegex = /^data:text\/plain;(base64)?,(.*)$/;
const numberRegex = /^(?:\+|-|)\d+(?:\.\d+)?/;

export function decode(line:string):OSCMessage {
	const parts = line.split(' ');
	return parts.map( (p) => {
		if( numberRegex.exec(p) ) return parseFloat(p);
		let m:RegExpExecArray|null;
		if( (m = dataRegex.exec(p)) ) {
			let decoded = atob(m[2]);
			let data = new Uint8Array(decoded.length);
			for( let i=decoded.length; i>=0; --i ) data[i] = decoded.charCodeAt(i);
			return decoded;
		}
		switch( p ) {
		case 'true': case 't': return true;
		case 'false': case 'f': return false;
		case 'nil': return undefined;
		}
		return p;
	});
}

export function lineIterator<T>( lineCallback:(line:string|undefined)=>T ):(text:string|undefined)=>void {
	let buffer = "";
	const flush = function() {
		let newlinePos:number;
		while( (newlinePos = buffer.indexOf("\n", )) != -1 ) {
			lineCallback(buffer.substr(0,newlinePos));
			buffer = buffer.substr(newlinePos+1);
		}
	}
	return (line) => {
		if( line == undefined ) {
			buffer += "\n";
			flush();
			lineCallback(undefined);
		} else {
			buffer += line;
			flush();
		}
	};
}

export function textToOscEmitter( oscCallback:(osc:OSCMessage|undefined)=>void ):(text:string|undefined)=>void {
	return lineIterator( (line) => {
		if( line == undefined ) { oscCallback(undefined); return; }
		line = line.trim();
		if( line == '' ) return;
		if( line.charCodeAt(0) == 0x23 ) return; // Assume '#' is a comment.
		oscCallback( decode(line) );
	} );
}

if( typeof require != 'undefined' && typeof module != 'undefined' && require.main == module ) {
	const textConsumer = textToOscEmitter( (oscMessage) => {
		console.log(oscMessage);
	});
	
	process.stdin.on('data', textConsumer);
	process.stdin.on('end', () => textConsumer(undefined) );
	process.stdin.resume();
}
