<?php

$demoConfig = [];

if( isset($argv) ) for( $i=1; $i<count($argv); ++$i ) {
	if( $argv[$i] == '--inline-resources' ) {
		$demoConfig['inlineResources'] = true;
	} else if( preg_match('/^(.*?)=(.*)$/', $argv[$i], $bif) ) {
		$demoConfig[$bif[1]] = $bif[2];
	} else {
		fwrite(STDERR, "Unrecognized argument: {$argv[$i]}\n");
		exit(1);
	}
}

require_once 'lib.php';

$demoConfigDefaults = [
	'mode' => 'editor',
	'title' => 'Shape Sheet Images!',
	'inlineResources' => false,
	'width' => 128,
	'height' => 64,
	'shapeViewMaxWidth' => 768,
	'shapeViewMaxHeight' => 384,
	'showUpdateRectangles' => false,
	'shadowDistanceOverride' => '',
	'demoMode' => 'shiftingLavaLamp',
	'lightningEnabled' => true,
	'lightRotationEnabled' => true,
];

foreach( $demoConfigDefaults as $k=>$default ) {
	if( isset($_REQUEST[$k]) ) $demoConfig[$k] = $_REQUEST[$k];
	else if( isset($demoConfig[$k]) ) continue;
	else if( is_callable($default) ) $demoConfig[$k] = call_user_func($default, $demoConfig);
	else $demoConfig[$k] = $default;
}

foreach( $demoConfigDefaults as $k=>$_ ) {
	$$k = $demoConfig[$k];
}

$showUpdateRectangles = parse_bool($showUpdateRectangles);
$inlineResources = parse_bool($inlineResources);

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
</style>
<title><?php eht($title); ?></title>
</head>
<body>

<div id="images">
</div>

<?php require_game21_js_libs($inlineResources);; ?>
<script type="text/javascript">
	require(['SSIDemo'], function(ssiDemo) {
		const SSIDemo = ssiDemo.default;
		var image = SSIDemo.randomShapeImage();
		document.getElementById('images').appendChild(image);
	});
</script>

</body>
</html>
