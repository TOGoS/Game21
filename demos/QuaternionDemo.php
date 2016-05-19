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
.gallery-container {
	min-height: 100%;
	display: flex;
	flex-direction: row;
	justify-content: center;
	align-items: center;
}
.gallery {
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	min-width: 20px;
	min-height: 20px;
	border: 1px dotted silver;
}
.gallery td {
	text-align: center;
	vertical-align: middle;
}
td.x0a0c {
	background: darkblue;
}
td.x1a1c {
	background: darkblue;
}


</style>
<title>QuaternionDemo</title>
</head>
<body>

<div class="gallery-container">
<table class="gallery">
<tbody id="gallery"></tbody>
</table>
</div>

<?php require_game21_js_libs($inlineResources); ?>
<script type="text/javascript">
(function() {
	var QuaternionDemo, quaternionDemo;
	var galleryTbody = document.getElementById('gallery');
	
	function generateRow( a, b ) {
		var tr = document.createElement('tr');
		var c, d, q, image, td;
		for( c = -1; c < 1; c += 0.5 ) {
			for( d = -1; d < 1; d += 0.5 ) {
				image = quaternionDemo.generateImageSlice(a, b, c, d).sheet;
				image.setAttribute("title", "<"+a+", "+b+", "+c+", "+d+">");
				td = document.createElement('td');
				td.className = "x"+((2+(a*2))%2)+"a"+((2+(c*2))%2)+"c";
				td.appendChild(image);
				tr.appendChild(td);
			}
		}
		galleryTbody.appendChild(tr);
	}
	
	function generateSomeImages() {
		var a = -1;
		var b = -1;
		var generateRowTimeout = function() {
			generateRow(a, b);
			b += 0.5;
			if( b == 1 ) {
				a += 0.5;
				b = -1;
			}
			if( a != 1 ) {
				setTimeout(generateRowTimeout, 100);
			}
		}; 
		setTimeout(generateRowTimeout);
	}
	
	require(['togos-game21/QuaternionDemo', 'togos-game21/materials'], function(_QuaternionDemo, _materials) {
		QuaternionDemo = _QuaternionDemo.default;
		quaternionDemo = new QuaternionDemo();
		generateSomeImages();
	});
})();
</script>

</body>
</html>
