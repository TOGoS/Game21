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

<?php require_game21_js_libs($inlineResources);; ?>

<script>//<![CDATA[
(function() {
	var CanvasWorldView;
	
	require(['togos-game21/CanvasWorldView'], function(_CanvasWorldView) {
		CanvasWorldView = _CanvasWorldView.default;
		var wv = new CanvasWorldView();
		wv.initUi(document.getElementById('world-view-canvas'));
		wv.runDemo2();
	});
})();
//]]></script>

</body>
</html>
