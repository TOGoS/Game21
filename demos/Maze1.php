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
	background: black;
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
	border: 1px solid #333344;
	width: 640px;
	height: 480px;
	box-sizing: content-box;
}
/* ]]> */</style>

<div class="maze-area">
<canvas class="maze-canvas" id="maze-canvas" width="<?php eht($width); ?>" height="<?php eht($height); ?>"/>
</div>

<?php require_game21_js_libs($inlineResources, array('togos-game21/Maze1')); ?>
<script type="text/javascript">//<![CDATA[
	require(['togos-game21/Maze1'], function(_Maze1) {
		var demo = _Maze1.startDemo(document.getElementById('maze-canvas'));
		window.addEventListener('keydown', function(keyEvent) {
			switch( keyEvent.keyCode ) {
			case 68: demo.walk(0); break;
			case 83: demo.walk(2); break;
			case 65: demo.walk(4); break;
			case 87: demo.walk(6); break;
			default:
				console.log("Key down: "+keyEvent.keyCode)
			}
		});
	});
//]]></script>

</body>
</html>
