<?php

function eht($text) {
	echo htmlspecialchars($text);
}
function ejsv($v) {
	echo json_encode($v);
}

function require_css($file, $inline=true) {
	if( $inline ) {
		echo "<style type=\"text/css\">/* <![CDATA[ */\n";
		require $file;
		echo "/* ]]> */</style>\n";
	} else {
		echo "<link rel=\"stylesheet\" type=\"text/css\" href=\"".htmlspecialchars($file)."\"/>\n";
	}
};

function require_js($files, $inline=true) {
	if( is_scalar($files) ) $files = array($file);
	if( $inline ) {
		echo "<script type=\"text/javascript\">/* <![CDATA[ */\n";
		foreach( $files as $file ) {
			echo "////// $file //////\n\n";
			require $file;
		}
		echo "/* ]]> */</script>\n";
	} else {
		foreach( $files as $file ) {
			echo "<script type=\"text/javascript\" src=\"".htmlspecialchars($file)."\"></script>\n";
		}
	}
};

function parse_bool($b, $emptyValue=false) {
	if( $b === null ) return $emptyValue;
	if( is_bool($b) ) return $b;
	if( is_numeric($b) ) {
		if( $b === 0 ) return false;
		if( $b === 1 ) return true;
	}
	if( is_string($b) ) {
		$b = strtolower(trim($b));
		switch( $b ) {
		case '': return $emptyValue;
		case 'yes': case 'y': case 't': case 'true': case 'on':
			return true;
		case 'no': case 'n': case 'f': case 'false': case 'off':
			return false;
		}
	}
	throw new Exception("Unrecognized representatin of boolean: ".var_export($b,true));
}

/**
 * Fit iw,ih into cw,ch, preserving aspect ratio
 */
function fitpar($cw, $ch, $iw, $ih) {
	if( $iw < $cw ) {
		$ih *= ($cw / $iw);
		$iw = $cw;
	} else if( $ih < $ch ) {
		$iw *= ($ch / $ih);
		$iw = $cw;
	}
	if( $iw > $cw ) {
		$ih *= ($cw / $iw);
		$iw = $cw;
	}
	if( $ih > $ch ) {
		$iw *= ($ch / $ih);
		$ih = $ch;
	}
	return array($iw, $ih);
}