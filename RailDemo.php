<?php
	require_once 'lib.php';
	
	if( !isset($title) ) $title = "Rail Demo";
	if( !isset($inlineResources) ) $inlineResources = false;
	if( !isset($width ) ) $width  = isset($_REQUEST['width' ]) ? $_REQUEST['width' ] : 256;
	if( !isset($height) ) $height = isset($_REQUEST['height']) ? $_REQUEST['height'] : 256;
	
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
	background: rgb(24,0,24);
}
canvas.shape-view {
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

<?php require_game21_js_libs($inlineResources);; ?>
<script type="text/javascript">//<![CDATA[
	require(['RailDemo'], function(RailDemo) {
		RailDemo.runDemo();
	});
//]]></script>

</body>
</html>
