<?php

require_once 'lib.php';

$demoConfigDefaults = [
	'scale' => 16,
	'width' => function($config) { return $config['scale'] * 16; },
	'height' => function($config) { return $config['scale'] * 16; },
	'superSampling' => 2,
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
	box-sizing: border-box;
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
	require(['togos-game21/RailDemo'], function(RailDemo) {
		const superSampling = <?php ejsv($superSampling); ?>;
		const scale = <?php ejsv($scale); ?>;
		var railDemo = RailDemo.buildDemo(superSampling);
		railDemo.scale = scale*superSampling;;
		railDemo.run();
	});
//]]></script>

</body>
</html>
