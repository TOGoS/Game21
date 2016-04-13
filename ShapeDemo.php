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
	'title' => 'Blobs!',
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
.preview-region {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
}
canvas.shape-view {
	image-rendering: -moz-crisp-edges;
	image-rendering: pixelated;
}
</style>
<title><?php eht($title); ?></title>
</head>
<body>

<p style="position:fixed; color:white">FPS: <span id="fps-counter">&nbsp;</span></p>

<div class="preview-region">
<canvas id="shaded-preview-canvas" class="shape-view"
  width="<?php eht($width); ?>" height="<?php eht($height); ?>"
  data-show-update-rectangles="<?php eht($showUpdateRectangles); ?>"
  data-shadow-distance-override="<?php eht($shadowDistanceOverride); ?>"
  data-demo-mode="<?php eht($demoMode); ?>"
  data-lightning-enabled="<?php eht($lightningEnabled); ?>"
  data-light-rotation-enabled="<?php eht($lightRotationEnabled); ?>"
  style="width: <?php eht($shapeViewWidth); ?>px; height: <?php eht($shapeViewHeight); ?>px"
></canvas>
</div>

<?php require_game21_js_libs($inlineResources);; ?>
<script type="text/javascript">
	require(['togos-game21/ShapeSheetDemo'], function(ShapeSheetDemo) { });
</script>

<?php if($lightningEnabled): ?>
<audio src="http://music-files.nuke24.net/uri-res/raw/urn:sha1:BK32QIASOGQD4AE5BV36GDO7JDBDDS7T/thunder.mp3" type="audio/mpeg" autoplay="autoplay" loop="loop"/>
<?php endif; ?>

</body>
</html>
