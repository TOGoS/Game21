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
	'title' => [
		'valueType' => 'string',
		'defaultValue' => 'Belts!',
		'affects' => 'pageGeneration',
	],
	'shapeViewMaxWidth' => [
		'valueType' => 'number',
		'defaultValue' => 768,
		'affects' => 'pageGeneration',
	],
	'shapeViewMaxHeight' => [
		'valueType' => 'number',
		'defaultValue' => 384,
		'affects' => 'pageGeneration',
	],
	'width' => [
		'valueType' => 'number',
		'defaultValue' => 192,
		'affects' => 'pageGeneration',
	],
	'height' => [
		'valueType' => 'number',
		'defaultValue' => 96,
		'affects' => 'pageGeneration',
	],
	'inlineResources' => [
		'valueType' => 'boolean',
		'defaultValue' => false,
		'affects' => 'pageGeneration',
	],
];

$config = config_from_env($configProperties, $config);
extract($config, EXTR_SKIP|EXTR_REFS);

list($shapeViewWidth, $shapeViewHeight) = fitpar($shapeViewMaxWidth, $shapeViewMaxHeight, $width, $height);

?>
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
html, body {
	background: black;
	width: 100%;
	height: 100%;
	margin: 0;
	box-sizing: border-box;
}
.main-content {
	min-height: 100%;
	margin: 0;
	display: flex;
	flex-direction: column;
	justify-content: center;
}
.preview-region {
	display: flex;
	align-items: center;
	justify-content: center;
}
canvas.shape-view {
	image-rendering: -moz-crisp-edges;
	image-rendering: pixelated;
}
.adjustment-form {
	color: silver;
}
.adjustment-form input[type="text"],
.adjustment-form input[type="checkbox"] {
	border: 1px inset rgb(128,64,64);
	background: rgb(64,0,0);
	color: white;
}
.adjustment-form input[type="submit"], .adjustment-form button {
	border: 1px outset darkgray;
	background: darkgray;
	color: rgb(64,0,0);
	font-weight: bold;
	text-shadow: 0px +1px rgba(255,255,255,0.5), 0px -1px rgba(0,0,0,0.5);
}

.adjustment-form .parameters {
	display: table;
}
.adjustment-form .parameters > div {
	display: table-row;
}
.adjustment-form .parameters > div > * {
	display: table-cell;
}
.adjustment-form .parameters > div > *:first-child {
	display: table-cell;
	padding-right: 10px;
}
</style>
<title><?php eht($title); ?></title>
</head>
<body>

<!-- Config: <?php echo json_encode($config, JSON_PRETTY_PRINT); ?> -->

<p style="position:fixed; color:white">FPS: <span id="fps-counter">&nbsp;</span></p>

<div class="main-content">
<div class="preview-region">
<canvas id="demo-canvas" class="shape-view"
  width="<?php eht($width); ?>" height="<?php eht($height); ?>"
  style="width: <?php eht($shapeViewWidth); ?>px; height: <?php eht($shapeViewHeight); ?>px"
></canvas>
</div>

<?php require_game21_js_libs($inlineResources);; ?>
<script type="text/javascript">
	require(['togos-game21/demo/BeltDemo'], function(_BeltDemo) {
		var canv = document.getElementById('demo-canvas')
		var bd = _BeltDemo.buildUi(canv);
		bd.start();
	});
</script>
<script type="text/javascript">
</script>

</body>
</html>
