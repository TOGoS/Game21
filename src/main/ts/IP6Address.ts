type IP6Address = Uint8Array; 

export function parseIp6Address(addrText):IP6Address {
	var wordTexts:string[] = addrText.split(':');
	if( wordTexts.length > 8 ) {
		throw new Error("Too many digit groups in IPv6 address: "+addrText);
	}
	var i:number, j:number, implicitBlanks:boolean=false;
	for( i=0; i<wordTexts.length; ++i ) {
		if( wordTexts[i] == '' ) {
			if( implicitBlanks ) {
				throw new Error("IP6 address text has more than one '::': "+addrText);
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
	var words:DataView = new DataView(addr.buffer);
	// TODO: shorten
	var i;
	var wordTexts = [];
	for( i=0; i < 8; ++i ) {
		wordTexts.push(words.getUint16(i<<1).toString(16));
	}
	return wordTexts.join(':');
}

export default IP6Address;
