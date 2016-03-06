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

function require_js($file, $inline=true) {
	if( $inline ) {
		echo "<script type=\"text/javascript\">/* <![CDATA[ */\n";
		require $file;
		echo "/* ]]> */</script>\n";
	} else {
		echo "<script type=\"text/javascript\" src=\"".htmlspecialchars($file)."\"></script>\n";
	}
};
