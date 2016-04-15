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
	'grainSize' => 10,
	'simplexScale' => 1,
	'inlineResources' => false,
	'width' => 96,
	'height' => 96,
	'shapeViewMaxWidth' => 768,
	'shapeViewMaxHeight' => 384,
	'showUpdateRectangles' => false,
	'shadowDistanceOverride' => '',
	'zShiftingEnabled' => true,
	'lavaLampEnabled' => true,
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
.main-content {
	height: 100%;
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
.adjustment-form input[type="text"] {
	border: 1px inset rgb(128,64,64);
	background: rgb(64,0,0);
	color: white;
}
.adjustment-form input[type="submit"] {
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

<!-- Demo config: <?php echo json_encode($demoConfig, JSON_PRETTY_PRINT); ?> -->

<p style="position:fixed; color:white">FPS: <span id="fps-counter">&nbsp;</span></p>

<div class="main-content">
<div class="preview-region">
<canvas id="demo-canvas" class="shape-view"
  width="<?php eht($width); ?>" height="<?php eht($height); ?>"
  style="width: <?php eht($shapeViewWidth); ?>px; height: <?php eht($shapeViewHeight); ?>px"
></canvas>
</div>

<form name="adjustment-form" id="adjustment-form" class="adjustment-form">
<div class="parameters">
<div><label>Grain size</label>   <input type="text" value="<?php eht($grainSize); ?>" name="grainSize" title="grain width"/></div>
<div><label>Simplex scale</label><input type="text" value="<?php eht($simplexScale); ?>" name="simplexScale" title="simplex scale"/></div>
</div>
<input type="submit" value="Regenerate"/>
</form>
</div>

<?php require_game21_js_libs($inlineResources);; ?>
<script type="text/javascript">
	require(['togos-game21/ShapeSheetDemo'], function(_ShapeSheetDemo) {
		var canv = document.getElementById('demo-canvas')
		var shapeSheetDemo = _ShapeSheetDemo.buildShapeDemo(canv);
		var adjForm = document.getElementById('adjustment-form');
		
		var regenerate = function() {
			shapeSheetDemo.grainSize = parseFloat(adjForm.grainSize.value);
			shapeSheetDemo.simplexScale = parseFloat(adjForm.simplexScale.value);
			shapeSheetDemo.shapeSheet.initBuffer();
			shapeSheetDemo.buildDensityFunctionDemoShapes();
		};
		
		adjForm.addEventListener('submit', function(evt) {
			evt.preventDefault();
			regenerate();
		});
		
		shapeSheetDemo.shifting = <?php ejsv($zShiftingEnabled); ?>;
		
		regenerate();
		if( <?php ejsv($lightRotationEnabled); ?> ) shapeSheetDemo.startLightRotation();
		if( <?php ejsv($lavaLampEnabled); ?> ) shapeSheetDemo.startLavaLamp();
		if( <?php ejsv($lightningEnabled); ?> ) shapeSheetDemo.startLightning();
		shapeSheetDemo.renderer.shadowDistanceOverride = <?php ejsv($shadowDistanceOverride); ?>;
		shapeSheetDemo.renderer.showUpdateRectangles = <?php ejsv($showUpdateRectangles); ?>;
	});
</script>
<script type="text/javascript">
</script>

<?php if($lightningEnabled): ?>
<audio src="http://music-files.nuke24.net/uri-res/raw/urn:sha1:BK32QIASOGQD4AE5BV36GDO7JDBDDS7T/thunder.mp3" type="audio/mpeg" autoplay="autoplay" loop="loop"/>
<?php endif; ?>

</body>
</html>
