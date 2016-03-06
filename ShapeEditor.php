<?php
	require_once 'lib.php';
	if( !isset($mode ) ) $mode = 'editor';
	if( !isset($title) ) $title = ($mode === 'demo' ? 'Shapes!' : 'Shape Editor');
	if( !isset($inlineResources) ) $inlineResources = ($mode === 'demo');
?>
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
body {
	background: black;
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
<?php if( $mode === 'demo' ): ?>
	width: 512px;
	height: 512px;
<?php else: ?>
	width: 384px;
	height: 384px;
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
<canvas id="shaded-preview-canvas" class="shape-view" width="64" height="64">
</canvas>
</div>

<?php require_js('ShapeSheet.js', $inlineResources); ?>
<?php require_js('ShapeSheetRenderer.js', $inlineResources); ?>
<?php require_js('ShapeSheetUtil.js', $inlineResources); ?>
<?php if($mode === 'demo'): ?>
<?php require_js('ShapeSheetDemo.js', $inlineResources); ?>
<?php endif; ?>
<script type="text/javascript">//<![CDATA[
(function() {
	"use strict";
	
	var canv = document.getElementById('shaded-preview-canvas');

	var shapeSheet = new ShapeSheet(64,64);
	var shapeSheetRenderer = new ShapeSheetRenderer(shapeSheet, canv);
	shapeSheetRenderer.shaders.push(ShapeSheetRenderer.makeFogShader(0, 0, 0, 0, 0.01));
	var shapeSheetUtil = new ShapeSheetUtil(shapeSheet, shapeSheetRenderer);
<?php if($mode === 'demo'): ?>
	var shapeSheetDemo = new ShapeSheetDemo(shapeSheetUtil);
	shapeSheetDemo.buildDemo();
	shapeSheetDemo.animateLights();
	shapeSheetDemo.animateLavaLamp();
	window.shapeSheetUtil = shapeSheetUtil;
<?php endif; ?>
	
	window.resizeShapeSheet = function(w,h) {
		canv.width = w;
		canv.height = h;
		se.initBuffer(w,h);
		se.buildDemo();
	};

	window.shapeSheetDemo = shapeSheetDemo;
})();
//]]></script>


</body>
</html>
