<?php
	require_once 'lib.php';
	if( !isset($mode ) ) $mode = 'editor';
	if( !isset($title) ) $title = ($mode === 'demo' ? 'Shapes!' : 'Shape Editor');
	if( !isset($inlineResources) ) $inlineResources = ($mode === 'demo');
	if( !isset($width ) ) $width  = isset($_REQUEST['width' ]) ? $_REQUEST['width' ] : 128;
	if( !isset($height) ) $height = isset($_REQUEST['height']) ? $_REQUEST['height'] :  64;
	
	$shapeViewMaxWidth = 768;
	$shapeViewMaxHeight = 384;
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
	box-model: border-box;
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

<div class="preview-region">
<canvas id="shaded-preview-canvas" class="shape-view"
  width="<?php eht($width); ?>" height="<?php eht($height); ?>"
  style="width: <?php eht($shapeViewWidth); ?>px; height: <?php eht($shapeViewHeight); ?>px;"
></canvas>
</div>

<?php
	$requireJsFiles = [
		'ShapeSheet.js',
		'ShapeSheetRenderer.js',
		'ShapeSheetUtil.js'
	];
	
	if( $mode === 'demo' ) $requireJsFiles[] = 'ShapeSheetDemo.js';

	require_js($requireJsFiles, $inlineResources);
?>
<script type="text/javascript">//<![CDATA[
(function() {
	"use strict";
	
	var canv = document.getElementById('shaded-preview-canvas');

	var shapeSheet = new ShapeSheet(<?php echo "$width,$height"; ?>);
	var shapeSheetRenderer = new ShapeSheetRenderer(shapeSheet, canv);
	shapeSheetRenderer.shaders.push(ShapeSheetRenderer.makeFogShader(0, 0, 0, 0, 0.01));
	var shapeSheetUtil = new ShapeSheetUtil(shapeSheet, shapeSheetRenderer);
<?php if($mode === 'demo'): ?>
	var shapeSheetDemo = new ShapeSheetDemo(shapeSheetUtil);
	//shapeSheetDemo.buildDemo();
	shapeSheetDemo.buildPolygonDemo();
	shapeSheetDemo.animateLights();
	//shapeSheetDemo.animateLavaLamp();
	shapeSheetDemo.animateLightning();
<?php endif; ?>
	
	window.resizeShapeSheet = function(w,h) {
		canv.width = w;
		canv.height = h;
		shapeSheet.initBuffer(w,h);
		shapeSheetDemo.buildDemo();
	};
	
	window.shapeSheet = shapeSheet;
	window.shapeSheetUtil = shapeSheetUtil;
	window.shapeSheetDemo = shapeSheetDemo;
})();
//]]></script>


</body>
</html>
