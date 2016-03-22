var IP6Address = {
	parse: function(addrText) {
		var wordTexts = addrText.split(':');
		if( wordTexts.length > 8 ) {
			throw new Error("Too many digit groups in IPv6 address: "+addrText);
		}
		var i, j, implicitBlanks=false;
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
		
		var addr = new Uint8Array(16);
		var words = new DataView(addr.buffer);
		for( i=0; i<wordTexts.length && wordTexts[i] != ''; ++i ) {
			words.setUint16(i<<1, parseInt(wordTexts[i], 16));
		}
		for( i=wordTexts.length-1, j=7; i>=0 && wordTexts[i] != ''; --i, --j ) {
			words.setUint16(i<<1, parseInt(wordTexts[i], 16));
		}
		return addr;
	},
	stringify: function(addr, shorten) {
		if( shorten == undefined ) shorten = true;
		var words = new DataView(addr.buffer);
		// TODO: shorten
		var i;
		var wordTexts = [];
		for( i=0; i<8; ++i ) {
			wordTexts.push(words.getUint16(i<<1).toString(16));
		}
		return wordTexts.join(':');
	}
};

if( typeof module !== 'undefined' ) module.exports = IP6Address;
