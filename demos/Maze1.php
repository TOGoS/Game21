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
	'pageTitle' => [
		'valueType' => 'string',
		'defaultValue' => 'Maze',
		'affects' => 'pageGeneration',
	],
	'saveGameRef' => [
		'valueType' => 'string',
		'defaultValue' => null,
		'affects' => 'pageGeneration',
	],
];

$config = config_from_env($configProperties, $config);
extract($config, EXTR_SKIP|EXTR_REFS);

?>
<!DOCTYPE html>
<html>
<head>
<title><?php eht($pageTitle); ?></title>
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
.game-interface {
	display: flex;
	width: 100%;
	height: 100vh;
	flex-direction: column;
	justify-content: space-around;
}
.maze-area {
	width: 100%;
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
	image-rendering: pixelated;
}

ul.tile-palette {
	display: flex;
	flex-direction: row;
	justify-conent: left;
	margin: 0; padding: 0;
	list-style-type: none;
}
ul.tile-palette li {
	margin: 2px;
	border: 1px solid #444;
	padding: 2px;
	box-sizing: content-box;
	width: 32px;
	height: 32px;
	background-origin: content-box;
	background-size: contain;
	background-position: center;
	background-repeat: no-repeat;
	image-rendering: pixelated;
}
ul.tile-palette li.selected {
	border-color: #FFF;
}
.button-bar {
	display: flex;
	flex-direction: row;
	justify-content: flex-start;
	align-items: center;
}
.button-bar > fieldset {
	display: table-row;
	flex-direction: row;
	justify-content: flex-start;
	flex-basis: content;
	border: none;
	margin: 0;
	padding: 0;
}
.button-bar > fieldset > * {
	display: table-cell;
}
.button-bar > *:nth-child(n+2) {
	margin-left: 8px;
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

<div class="game-interface">
<div class="maze-area" id="maze-area">
<canvas class="maze-canvas" id="maze-canvas" width="<?php eht($width); ?>" height="<?php eht($height); ?>"/>
</div>

<div id="tile-palette-area"></div>
<div id="button-area" class="button-bar"></div>
</div>

<?php require_game21_js_libs($inlineResources, array('togos-game21/Maze1')); ?>
<script type="text/javascript">//<![CDATA[
	require(['togos-game21/Maze1'], function(_Maze1) {
		var demo = _Maze1.startDemo(document.getElementById('maze-canvas'), <?php ejsv($saveGameRef); ?>);
		window.maze1Demo = demo;
		window.addEventListener('keydown', demo.keyDown.bind(demo));
		window.addEventListener('keyup', demo.keyUp.bind(demo));
		
		const fogColor = 'rgba(58,58,64,1)';
		demo.view.occlusionFillStyle = fogColor;
		document.getElementById('maze-area').style.background = fogColor;
	});
//]]></script>

</body>
</html>
