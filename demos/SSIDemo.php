<?php

$demoConfig = [];

if( isset($argv) ) for( $i=1; $i<count($argv); ++$i ) {
	if( $argv[$i] == '--inline-resources' ) {
		$demoConfig['inlineResources'] = true;
	} else if( preg_match('/^(.*?)=(.*)$/', $argv[$i], $bif) ) {
		$demoConfig[$bif[1]] = $bif[2];
	} else {
		fwrite(STDERR, "Unrecognized argument: {$argv[$i]}\n");
		exit(1);
	}
}

require_once 'lib.php';

$demoConfigDefaults = [
	'mode' => 'editor',
	'title' => 'Shape Sheet Images!',
	'inlineResources' => false,
	'width' => 128,
	'height' => 64,
	'shapeViewMaxWidth' => 768,
	'shapeViewMaxHeight' => 384,
	'showUpdateRectangles' => false,
	'shadowDistanceOverride' => '',
	'demoMode' => 'shiftingLavaLamp',
	'lightningEnabled' => true,
	'lightRotationEnabled' => true,
];

foreach( $demoConfigDefaults as $k=>$default ) {
	if( isset($_REQUEST[$k]) ) $demoConfig[$k] = $_REQUEST[$k];
	else if( isset($demoConfig[$k]) ) continue;
	else if( is_callable($default) ) $demoConfig[$k] = call_user_func($default, $demoConfig);
	else $demoConfig[$k] = $default;
}

foreach( $demoConfigDefaults as $k=>$_ ) {
	$$k = $demoConfig[$k];
}

$showUpdateRectangles = parse_bool($showUpdateRectangles);
$inlineResources = parse_bool($inlineResources);

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
	box-sizing: border-box;
	color: white;
}
/* Since { display: inline-flex; margin: auto } doesn't work like I expect, have a container. :P */
.image-gallery-container {
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
<title><?php eht($title); ?></title>
</head>
<body>

<p>I've always wanted to be able to store generic 'shapes' and
re-render them with different materials and different lighting
conditions rather than have to decide on those things up front when
hand-crafting graphics for a game.  None of my games so far have got
to the point where graphics really matter all that much, but
nonetheless the lack of such a system has bothered me to the point
that I decided I needed to finally write it.</p>

<p>If my JavaScript runs in your browser, this box should soon be filled with some randomly generated shapes:</p>

<div class="image-gallery-container">
<div class="image-gallery" id="image-gallery"></div>
</div>

<p>Reload the page to generate new ones.</p>

<p>This system is based around objects called ShapeSheets, which are defined by
a width*height array of material indexes,
and a width*height*4 array of cell corner depths (a number for the depth of each corner).</p>

<p>Material indexes are an integer 0-255.
A mapping of material information is provided separately to the renderer
so that a single shape can be rendered multiple different ways
(a good example use case would be an object with indicator lights on it;
you'll be able to re-use the same shape with the lights in different states
or different colors).
For now a material is only defined by a single diffuse color + opactity,
but I intend to add support for multiple surface layers
each with various other properties such as roughness and inherent brightness.</p>

<p>This project's written in TypeScript, which is pretty nice.
I use a drop-in replacement for RequireJS to load the compiled JavaScript.</p>

<?php require_game21_js_libs($inlineResources); ?>
<script type="text/javascript">
(function() {
	var SSIDemo, ssiDemo, materialsPackage;
	var galleryDiv = document.getElementById('image-gallery');
	
	function generateRow() {
		var row = document.createElement('div');
		for( var i=0; i < 10; ++i ) {
			ssiDemo.randomShapeImage();
			row.appendChild(ssiDemo.randomShapeImage());
		}
		galleryDiv.appendChild(row);
		ssiDemo.materials = materialsPackage.randomMaterialMap();
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
	
	require(['SSIDemo', 'Materials'], function(_SSIDemo, _Materials) {
		SSIDemo = _SSIDemo.default;
		ssiDemo = new SSIDemo();
		materialsPackage = _Materials;
		generateSomeImages();
	});
})();
</script>

</body>
</html>
