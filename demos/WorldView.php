<?php

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

require_once 'lib.php';

$configProperties = [
	'inlineResources' => [
		'valueType' => 'boolean',
		'defaultValue' => false,
		'affects' => 'pageGeneration',
	],
];

$config = config_from_env($configProperties, $config);
extract($config, EXTR_SKIP|EXTR_REFS);

?>
<html>
<head>
<meta charset="utf-8"/>
<style>
.world-view-region {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
}
.world-view-canvas {
	background: black;
	width: 640px;
	height: 480px;
	image-rendering: pixelated;
}
</style>
</head>
<body style="background: rgb(32,0,0)">

<div class="world-view-region">
<canvas id="world-view-canvas" class="world-view-canvas" width="320" height="240">
</canvas>
</div>

<?php require_game21_js_libs($inlineResources);; ?>

<script>//<![CDATA[
(function() {
	var CanvasWorldView;
	
	require(['togos-game21/MazeGame'], function(_MazeGame) {
		MazeGame = _MazeGame.default;
		var mg = new MazeGame();
		mg.initUi(document.getElementById('world-view-canvas'));
		mg.runDemo();
	});
})();
//]]></script>

</body>
</html>
