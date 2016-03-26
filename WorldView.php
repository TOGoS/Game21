<?php
	require_once 'lib.php';
	if( !isset($mode ) ) $mode = 'normal';
	if( !isset($title) ) $title = ($mode === 'demo' ? 'Shapes!' : 'Shape Editor');
	if( !isset($inlineResources) ) $inlineResources = ($mode === 'demo');
?>
<html>
<head>
<meta charset="utf-8"/>
<style>
.world-view-region {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
}
.world-view-canvas {
	background: black;
	width: 640px;
	height: 480px;
	image-rendering: pixelated;
}
</style>
</head>
<body style="background: rgb(32,0,0)">

<div class="world-view-region">
<canvas id="world-view-canvas" class="world-view-canvas" width="320" height="240">
</canvas>
</div>

<?php
	$requireJsFiles = [
		'DeepFreezer.js',
		'ShapeSheet.js',
		'ShapeSheetTransforms.js',
		'ShapeSheetRenderer.js',
		'ShapeSheetUtil.js',
		'CanvasWorldView.js'
	];
	
	require_js($requireJsFiles, $inlineResources);
?>
<script>//<![CDATA[
(function() {
	var wv = new CanvasWorldView();
	wv.initUi(document.getElementById('world-view-canvas'));
	wv.runDemo();
})();
//]]></script>

</body>
</html>
