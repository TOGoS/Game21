type IP6Address = Uint8Array; 

export function parseIp6Address(addrText:string):IP6Address {
	var wordTexts:string[] = addrText.split(':');
	if( wordTexts.length > 8 ) {
		throw new Error("Too many digit groups in IPv6 address: "+addrText);
	}
	var i:number, j:number, implicitBlanks:boolean=false;
	for( i=0; i < wordTexts.length; ++i ) {
		if( wordTexts[i] == '' ) {
			if( implicitBlanks ) {
				if( i == 1 ) {
					// it's like ::something, which is fine
				} else if( i == wordTexts.length-1 ) {
					// something::; also fine.
				} else {
					throw new Error("IP6 address text has more than one '::': "+addrText);
				}
			} else {
				implicitBlanks = true;
			}
		}
	}
	if( wordTexts.length != 8 && !implicitBlanks ) {
		throw new Error("IP6 address doesn't have enough digit groups: "+addrText);
	}
	
	var addr:IP6Address = new Uint8Array(16);
	var words = new DataView(addr.buffer);
	for( i=0; i < wordTexts.length && wordTexts[i] != ''; ++i ) {
		words.setUint16(i<<1, parseInt(wordTexts[i], 16));
	}
	if( implicitBlanks ) for( i=wordTexts.length-1, j=7; i>=0 && wordTexts[i] != ''; --i, --j ) {
		words.setUint16(j<<1, parseInt(wordTexts[i], 16));
	}
	return addr;
}

export function stringifyIp6Address(addr:Uint8Array, shorten:boolean=true):string {
	let currentZeroSpanOffset = 0;
	let currentZeroSpanLength = 0;
	let longestZeroSpanOffset = -1;
	let longestZeroSpanLength = 0;
	const words:DataView = new DataView(addr.buffer);
	for( let i=0; i < 8; ++i ) {
		if( shorten && words.getUint16(i << 1) == 0 ) {
			if( i == currentZeroSpanOffset + currentZeroSpanLength ) {
				++currentZeroSpanLength;
				if( currentZeroSpanLength > longestZeroSpanLength ) {
					longestZeroSpanOffset = currentZeroSpanOffset;
					longestZeroSpanLength = currentZeroSpanLength;
				}
			} else {
				currentZeroSpanOffset = i;
				currentZeroSpanLength = 1;
			}
		} else {
			currentZeroSpanLength = 0;
		}
	}
	
	if( longestZeroSpanLength < 2 ) {
		longestZeroSpanLength = 0;
		longestZeroSpanOffset = -1;
	}
	const longestZeroSpanEnd = longestZeroSpanOffset + longestZeroSpanLength;
	
	var wordTexts:string[] = [];
	for( let i=0; i < 8; ++i ) {
		if( i == longestZeroSpanOffset ) {
			if( i == 0 ) wordTexts.push('');
			wordTexts.push('');
		} else if( i > longestZeroSpanOffset && i < longestZeroSpanEnd ) {
			// do nothing
		} else {
			wordTexts.push(words.getUint16(i<<1).toString(16));
		}
	}
	if( longestZeroSpanEnd == 8 ) wordTexts.push('');
	return wordTexts.join(':');
}

export default IP6Address;
