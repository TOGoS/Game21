<?php

ini_set('display_errors','On');
error_reporting(E_ALL|E_STRICT);

$config = [];

if( isset($argv) ) for( $i=1; $i<count($argv); ++$i ) {
	if( $argv[$i] == '--inline-resources' ) {
		$config['inlineResources'] = true;
	} else if( preg_match('/^(.*?)=(.*)$/', $argv[$i], $bif) ) {
		$config[$bif[1]] = $bif[2];
	} else {
		fwrite(STDERR, "Unrecognized argument: {$argv[$i]}\n");
		exit(1);
	}
}

require_once __DIR__.'/lib.php';

$configProperties = [
	'inlineResources' => [
		'valueType' => 'boolean',
		'defaultValue' => function($config) { return !empty($config['asPlogEntry']); },
		'affects' => 'pageGeneration',
	]
];

$config = config_from_env($configProperties, $config);
extract($config, EXTR_SKIP|EXTR_REFS);

?>
<html>
<head>
<title>CharBuf Display Demo</title>
<style>
canvas { background: lime; }
body { background: black; }
</style>
</head>
<body>

<canvas id="charbuf-display" width="128" height="96"></canvas>

<?php require_game21_js_libs($inlineResources, array('togos-game21/graphics/CharBufDisplay')); ?>
<script type="text/javascript">//<![CDATA[
	require(['togos-game21/graphics/CharBufDisplay','togos-game21/graphics/437-8x8.bitmap-font'], function(_CharBufDisplay,_4378x8) {
		const display = {
			columnCount: 16,
			rowCount: 12,
			charWidth: 8,
			charHeight: 8,
			characterBuffer: new Uint8Array(12*16*4),
		};
		
		const canv = document.getElementById('charbuf-display');
		const ctx = canv.getContext('2d');
		const displayWidthPixels = display.columnCount*display.charWidth;
		const displayHeightPixels = display.rowCount*display.charHeight;
		const canvData = ctx.getImageData(0,0,displayWidthPixels,displayHeightPixels);
		
		display.characterBuffer[0] = 2;
		
		_CharBufDisplay.putText( display, 0, 0, "Hello! \x01 \x02 Woohoo!", 0x00, 0x3F, 0x03 );
		
		console.log("Re-rendering display...")
		_CharBufDisplay.displayToPixelData(
			display, 0, 0, display.columnCount, display.rowCount,
			[_4378x8.default],
			canvData.data
		);
		
		console.log("Copying pixel data back to canvas...")
		ctx.putImageData(canvData, 0, 0, 0, 0, displayWidthPixels, displayHeightPixels);
	});
//]]></script>

</body>
</html>
