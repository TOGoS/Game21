<?php

require_once 'lib.php';

$demoConfigDefaults = [
	'title' => 'Render Demo',
	'inlineResources' => false,
];

$config = config_from_env($demoConfigDefaults);
extract($config, EXTR_SKIP|EXTR_REFS);

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
<canvas id="render-canvas"
  width="256" height="128"
  style="width: 512px; height256px;"
></canvas>
</div>

<?php require_game21_js_libs($inlineResources, ['togos-game21/RenderDemo']); ?>
<script type="text/javascript">//<![CDATA[
	require(['togos-game21/RenderDemo'], function(_RenderDemo) {
		_RenderDemo.buildDemo(document.getElementById('render-canvas')).run();
	});
//]]></script>

</body>
</html>
