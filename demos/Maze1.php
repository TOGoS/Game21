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
		'defaultValue' => 192,
		'affects' => 'pageGeneration',
	],
	'height' => [
		'valueType' => 'number',
		'defaultValue' => 96,
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
}
/* ]]> */</style>

<div class="maze-area">
<canvas clas=s"maze-canvas" id="maze-canvas" width="<?php eht($width); ?>" height="<?php eht($height); ?>"/>
</div>

<?php require_game21_js_libs($inlineResources, array('togos-game21/Maze1')); ?>
<script type="text/javascript">//<![CDATA[
	require(['togos-game21/Maze1'], function(_Maze1) {
		_Maze1.startDemo(document.getElementById('maze-canvas'));
	});
//]]></script>

</body>
</html>
