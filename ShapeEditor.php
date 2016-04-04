<?php
	require_once 'lib.php';
	
	if( !isset($demoConfig) ) $demoConfig = [];
	
	$demoConfigDefaults = [
		'mode' => 'editor',
		'title' => function($vars) { return $vars['mode'] === 'demo' ? 'Shapes!' : 'Shape Editor'; },
		'inlineResources' => function($vars) { return $vars['mode'] === 'demo'; },
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
p#fps-counter {
	float: left;
	color: white;
}
.preview-region {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
<?php if( $mode === 'editor' ): ?>
	background: rgb(24,0,24);
<?php endif; ?>
}
canvas.shape-view {
<?php if( $mode === 'editor' ): ?>
	background: black;
<?php endif; ?>
	image-rendering: -moz-crisp-edges;
	image-rendering: pixelated;
}
</style>
<title><?php eht($title); ?></title>
</head>
<body>

<p id="fps-counter">&nbsp;</p>

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

<?php
// Awesome way
	require_js(['fakerequire.js', 'all.js'], $inlineResources);
?>
<script type="text/javascript">
	require(['ShapeSheetDemo'], function(ShapeSheetDemo) { });
</script>

<?php
// The stupid RequireJS way
/*
	require_js(['require.js'], $inlineResources, ['data-main'=>'ShapeSheetDemo']);
	$requireJsFiles = [
		'DeepFreezer.js',
		'ShapeSheet.js',
		'ShapeSheetRenderer.js',
		'ShapeSheetUtil.js',
		'FPSUpdater.js'
	];
	
	if( $mode === 'demo' ) $requireJsFiles[] = 'ShapeSheetDemo.js';
	
	require_js($requireJsFiles, $inlineResources);
*/
?>

<?php if($lightningEnabled): ?>
<audio src="http://music-files.nuke24.net/uri-res/raw/urn:sha1:BK32QIASOGQD4AE5BV36GDO7JDBDDS7T/thunder.mp3" type="audio/mpeg" autoplay="autoplay" loop="loop"/>
<?php endif; ?>

</body>
</html>
