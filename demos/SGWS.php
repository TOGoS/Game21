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
		'defaultValue' => 512,
		'affects' => 'pageGeneration',
	],
	'width' => [
		'valueType' => 'number',
		'defaultValue' => 512,
		'affects' => 'pageGeneration',
	],
	'height' => [
		'valueType' => 'number',
		'defaultValue' => 256,
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
	color: silver;
	width: 100%;
	height: 100%;
	margin: 0;
	box-sizing: border-box;
}
.canvas-region {
	background-color: darkred;
	margin: auto;
}
</style>
<title><?php eht($title); ?></title>
</head>
<body>

<!-- Config: <?php echo json_encode($config, JSON_PRETTY_PRINT); ?> -->

<div class="canvas-region">
<canvas id="sgws-canvas" class="shape-view"
  width="<?php eht($width); ?>" height="<?php eht($height); ?>"
  style="width: <?php eht($shapeViewWidth); ?>px; height: <?php eht($shapeViewHeight); ?>px"
></canvas>
</div>

<?php require_game21_js_libs($inlineResources);; ?>
<script type="text/javascript">
	require(['togos-game21/demo/SGWS'], function(_SGWS) {
		var canv = document.getElementById('sgws-canvas');
		_SGWS.createDemo(canv).start();
	});
</script>

</body>
</html>
