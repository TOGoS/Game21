<?php
	require_once 'lib.php';
	$mode = 'demo';
	$title = 'Shape Editor';
	$inlineResources = true;
?>
<html>
<meta charset="utf-8"/>
<head>
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

<?php require_js('ShapeEditor.js', $inlineResources); ?>
<script>//<![CDATA[
(function() {
	"use strict";
	
	var canv = document.getElementById('shaded-preview-canvas');
	
	var se = new ShapeEditor(64, 64);
	se.initUi(canv);
	se.buildDemo();
	se.animateLights();
	//se.animateLavaLamp();
	
	se.shaders.push(ShapeEditor.makeFogShader(0, 0, 0, 0, 0.01));

	window.resizeCanvas = function(w,h) {
		canv.width = w;
		canv.height = h;
		se.initBuffer(w,h);
		se.buildDemo();
	};

	window.shapeEditor = se;
})();
//]]></script>


</body>
</html>
