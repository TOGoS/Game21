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
	'simplexScale' => 1,
	'inlineResources' => false,
	'width' => 96,
	'height' => 96,
	'shapeViewMaxWidth' => 768,
	'shapeViewMaxHeight' => 384,
	'showUpdateRectangles' => false,
	'shadowDistanceOverride' => '',
	'demoMode' => 'shiftingLavaLamp',
	'lightningEnabled' => true,
	'lightRotationEnabled' => true,
];

$demoConfig = config_from_env($demoConfigDefaults, $demoConfig);
extract($demoConfig, EXTR_SKIP|EXTR_REFS);

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

<!-- Demo config: <?php echo json_encode($demoConfig, JSON_PRETTY_PRINT); ?> -->

<p style="position:fixed; color:white">FPS: <span id="fps-counter">&nbsp;</span></p>

<div class="preview-region">
<canvas id="shaded-preview-canvas" class="shape-view"
  width="<?php eht($width); ?>" height="<?php eht($height); ?>"
  data-show-update-rectangles="<?php eht($showUpdateRectangles); ?>"
  data-shadow-distance-override="<?php eht($shadowDistanceOverride); ?>"
  data-simplex-scale="<?php eht($simplexScale); ?>"
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

<form name="adjustment-form" id="adjustment-form">
<label>Grain size</label><input type="text" value="10" name="grainSize" title="grain width"/><br />
<label>Simplex scale</label><input type="text" value="1" name="simplexScale" title="simplex scale"/><br />
<input type="submit" value="Regenerate"/>
</form>

<script type="text/javascript">
	var adjForm = document.getElementById('adjustment-form');
	adjForm.addEventListener('submit', function(evt) {
		evt.preventDefault();
		shapeSheetDemo.grainSize = parseFloat(adjForm.grainSize.value);
		shapeSheetDemo.simplexScale = parseFloat(adjForm.simplexScale.value);
		shapeSheetDemo.shapeSheet.initBuffer();
		shapeSheetDemo.buildDensityFunctionDemoShapes();
	});
</script>

<?php if($lightningEnabled): ?>
<audio src="http://music-files.nuke24.net/uri-res/raw/urn:sha1:BK32QIASOGQD4AE5BV36GDO7JDBDDS7T/thunder.mp3" type="audio/mpeg" autoplay="autoplay" loop="loop"/>
<?php endif; ?>

</body>
</html>
