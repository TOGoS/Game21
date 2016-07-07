<?php

$config = [];

if( isset($argv) ) for( $i=1; $i<count($argv); ++$i ) {
	if( $argv[$i] == '--inline-resources' ) {
		$config['inlineResources'] = true;
	} else if( preg_match('/^(.*?)=(.*)$/', $argv[$i], $bif) ) {
		$config[$bif[1]] = $bif[2];
	} else {
		fwrite(STDERR, "Unrecognized argument: {$argv[$i]}\n");
		exit(1);
	}
}

require_once 'lib.php';

$configProperties = [
	'inlineResources' => [
		'valueType' => 'boolean',
		'defaultValue' => false,
		'affects' => 'pageGeneration',
	],
];

$config = config_from_env($configProperties, $config);
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
	color: white;
}
/* Since { display: inline-flex; margin: auto } doesn't work like I expect, have a container. :P */
.image-gallery-container {
	min-height: 100%;
	display: flex;
	flex-direction: row;
	justify-content: center;
	align-items: center;
}
.image-gallery {
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	min-width: 20px;
	min-height: 20px;
	border: 1px dotted silver;
}
.image-gallery div {
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	justify-content: center;
	align-items: center;
}
</style>
<title>SSIDemo</title>
</head>
<body>

<div class="image-gallery-container">
<div class="image-gallery" id="image-gallery"></div>
</div>

<?php require_game21_js_libs($inlineResources); ?>
<script type="text/javascript">
(function() {
	var SSIDemo, ssiDemo, surfacematerials;
	var galleryDiv = document.getElementById('image-gallery');
	
	function generateRow() {
		var row = document.createElement('div');
		for( var i=0; i < 10; ++i ) {
			console.log("Generating shape image #"+i+"...")
			row.appendChild(ssiDemo.randomShapeImageSlice().sheet);
		}
		galleryDiv.appendChild(row);
		ssiDemo.surfacematerials = surfacematerials.randomMaterialMap();
	}
	
	function generateSomeImages() {
		var j = 0;
		var generateRowTimeout = function() {
			generateRow(j);
			if( j < 4 ) {
				setTimeout(generateRowTimeout, 100);
				++j;
			}
		}; 
		setTimeout(generateRowTimeout);
	}
	
	require(['togos-game21/SSIDemo', 'togos-game21/surfacematerials'], function(_SSIDemo, _surfacematerials) {
		SSIDemo = _SSIDemo.default;
		ssiDemo = new SSIDemo();
		surfacematerials = _surfacematerials;
		generateSomeImages();
	});
})();
</script>

</body>
</html>
