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
		'DeepFreezer.js',
		'ShapeSheet.js',
		'ShapeSheetRenderer.js',
		'ShapeSheetUtil.js',
		'ShapeSheetDemo.js',
	];
	
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
	
	shapeSheetUtil.plottedMaterialIndexFunction = function(x,y,z) { return (Math.random()*4+8)|0; };
	shapeSheetUtil.plotAASharpBeveledCuboid( 0, 0, 0, 32, 32, 4 );
	shapeSheetUtil.plottedMaterialIndexFunction = function(x,y,z) { return 4; };
	shapeSheetUtil.plotSphere(  8,  8, 3, 4 );
	shapeSheetUtil.plotSphere( 24,  8, 3, 4 );
	shapeSheetUtil.plotSphere(  8, 24, 3, 4 );
	shapeSheetUtil.plotSphere( 24, 24, 3, 4 );
	shapeSheetRenderer.requestCanvasUpdate();
})();
//]]></script>


</body>
</html>
