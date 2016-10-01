function isComplex( a:any ) {
	for( let k in a ) {
		if( !a.hasOwnProperty(k) ) continue;
		if( typeof a[k] !== 'number' && a[k] != null ) return true;
	}
	return false;
}

/**
 * Encode arrays of numbers and simple objects on one line,
 * but everything else spaced out and indented.
 */
export default class PrettierJSONEncoder {
	public constructor( protected output:(t:string)=>void ) { }
	
	protected indentLevel = 0;
	protected indentString = "\t";
	
	protected emit( t:string ) {
		this.output(t);
	}
	
	protected emitIndent() {
		for( let i=0; i<this.indentLevel; ++i ) this.emit(this.indentString);
	}
	
	protected writeSimple( t:any ) {
		this.emit(JSON.stringify(t));
	}
	
	protected writeArray( t:any[] ) {
		if( isComplex(t) ) {
			this.emit("[\n");
			++this.indentLevel;
			for( let i=0; i<t.length; ++i ) {
				if( i != 0 ) this.emit(",\n");
				this.emitIndent();
				this.write(t[i]);
			}
			this.emit("\n");
			--this.indentLevel;
			this.emitIndent();
			this.emit("]");
		} else {
			this.emit(JSON.stringify(t));
		}
	}
	
	protected writeObject( t:any ) {
		if( !isComplex(t) ) {
			const simple = JSON.stringify(t);
			if( simple == null ) throw new Error(typeof t+" stringified to null!");
			if( simple.length <= 60 ) {
				this.emit(simple);
				return;
			}
		}
		
		this.emit("{\n");
		++this.indentLevel;
		let first = true;
		for( let i in t ) {
			if( !t.hasOwnProperty(i) || typeof t[i] == 'function' ) continue;
			if( !first ) this.emit(",\n");
			this.emitIndent();
			this.writeSimple(i);
			this.emit(": ");
			this.write(t[i]);
			first = false;
		}
		this.emit("\n");
		--this.indentLevel;
		this.emitIndent();
		this.emit("}");
	}
	
	public write( t:any ) {
		if( t == null || typeof t == 'function' ) {
			this.emit("null");
		} else if( typeof t === 'string' || typeof t === 'number' || typeof t === 'boolean' ) {
			this.emit(JSON.stringify(t));
		} else if( typeof t === 'object' ) {
			if( Array.isArray(t) ) {
				this.writeArray(t);
			} else {
				this.writeObject(t);
			}
		} else {
			throw new Error("Don't know how to stringify "+typeof t);
		}
	}
	
	public static stringify(thing:any) {
		const parts:string[] = [];
		const encoder = new PrettierJSONEncoder((s) => parts.push(s));
		encoder.write(thing);
		parts.push("\n");
		return parts.join("");
	}
}
