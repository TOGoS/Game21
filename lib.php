<?php

function eht($text) {
	echo htmlspecialchars($text);
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
