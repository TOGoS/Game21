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
	
	font-family: sans-serif;
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

.dialog-box {
	background: #444;
	border: 1px solid #666;
	padding: 0;

	display: flex;
	flex-direction: column
}
.dialog-box-content {
	flex-grow: 1;
	display: flex;
}
.dialog-box-header {
	display: flex;
	margin: 0; padding: 0;
	flex-direction: row;
	justify-content: space-between;
	flex-grow: 0;
	align-items: center;
}
.dialog-box-header button {
	margin: 16px;
}
.dialog-box h3 {
	margin: 0;
	padding: 16px;
	font-family: sans-serif;
}

#load-dialog {
	position: fixed;
	top: 10vh;
	left: 10vw;
	height: 80vh;
	width: 80vw;
}
#load-dialog ul {
	background: black;
	color: white;
	flex-grow: 1;
	margin: 0px 16px 16px 16px;
	padding: 0;
}
#load-list {
	overflow-y: scroll;
	list-style-type: none;
}
#load-list li {
	margin: 0;
	padding: 2px 4px;
	cursor: pointer;
}
#load-list li:hover {
	text-decoration: underline;
}

#camera-location-box {
	color: #880;
	mix-blend-mode: screen;
	font-family: monospace;
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
<div id="camera-location-box" style="position:absolute; top:0; left:0;"></div>
<canvas class="maze-canvas" id="maze-canvas" width="<?php eht($width); ?>" height="<?php eht($height); ?>"/>
</div>

<div id="tile-palette-area"></div>
<div id="button-area" class="button-bar"></div>
</div>

<div id="load-dialog" class="dialog-box" style="display:none">
  <div class="dialog-box-header">
    <h3>Load</h3>
    <button id="load-cancel-button">Cancel</button>
  </div>
  <div class="dialog-box-content">
    <ul id="load-list">
    </ul>
  </div>
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
