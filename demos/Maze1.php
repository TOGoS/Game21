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

require_once 'lib.php';

$configProperties = [
	'inlineResources' => [
		'valueType' => 'boolean',
		'defaultValue' => false,
		'affects' => 'pageGeneration',
	],
	'width' => [
		'valueType' => 'number',
		'defaultValue' => 320,
		'affects' => 'pageGeneration',
	],
	'height' => [
		'valueType' => 'number',
		'defaultValue' => 240,
		'affects' => 'pageGeneration',
	],	
];

$config = config_from_env($configProperties, $config);
extract($config, EXTR_SKIP|EXTR_REFS);

?>
<!DOCTYPE html>
<html>
<head>
<title>Maze</title>
</head>
<body>

<style scroped>/* <![CDATA[ */
html, body {
	background: rgba(96,64,64,1);
	margin: 0;
	padding: 0;
	color: white;
	box-sizing: border-box;
}
.maze-area {
	width: 100%;
	height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
}
.maze-canvas {
	background: black;
	border: 1px solid #333344;
	width: 320px;
	height: 240px;
	box-sizing: content-box;
}
@media (min-width: 640px) and (min-height: 500px) {
	.maze-canvas {
		width: 640px;
		height: 480px;
	}
}
@media (min-width: 960) and (min-height: 740) {
	.maze-canvas {
		width: 960px;
		height: 720px;
	}
}
/* ]]> */</style>

<div class="maze-area">
<canvas class="maze-canvas" id="maze-canvas" width="<?php eht($width); ?>" height="<?php eht($height); ?>"/>
</div>

<?php require_game21_js_libs($inlineResources, array('togos-game21/Maze1')); ?>
<script type="text/javascript">//<![CDATA[
	require(['togos-game21/Maze1'], function(_Maze1) {
		var demo = _Maze1.startDemo(document.getElementById('maze-canvas'));
		window.addEventListener('keydown', demo.keyDown.bind(demo));
		window.addEventListener('keyup', demo.keyUp.bind(demo));
	});
//]]></script>

</body>
</html>
