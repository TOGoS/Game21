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
td.x0a0b {
	background: darkblue;
}
td.x1a1b {
	background: darkblue;
}
td.identity {
	background: darkred;
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
	var QuaternionDemo, quaternionDemo, Quaternion;
	var galleryTbody = document.getElementById('gallery');

	function qToString( q ) {
		return "<"+q.a.toPrecision(3)+", "+q.b.toPrecision(3)+", "+q.c.toPrecision(3)+", "+q.d.toPrecision(3)+">";
	}
	
	function generateRow( a, c ) {
		var tr = document.createElement('tr');
		var b, d, q, image, td;
		for( b = -0.5; b <= 1; b += 0.5 ) {
			for( d = -0.5; d <= 1; d += 0.5 ) {
				td = document.createElement('td');
				var p = new Quaternion(a, b, c, d);
				if( a != 0 || b != 0 || c != 0 || d != 0 ) {
					var q = p.normalize();
					image = quaternionDemo.generateImageSlice(q).sheet;
					td.appendChild(image);
					td.setAttribute("title", qToString(q)+" (unnormalized: "+qToString(p)+")");
				} else {
					td.setAttribute("title", qToString(p));
				}
				td.className = "x"+((3+(a*2))%2)+"a"+((2+(b*2))%2)+"b";
				if( a == 1 && b == 0 && c == 0 && d == 0 ) {
					td.className += " identity";
				}
				tr.appendChild(td);
			}
		}
		galleryTbody.appendChild(tr);
	}
	
	function generateSomeImages() {
		var a = -0.5;
		var c = -0.5;
		var generateRowTimeout = function() {
			generateRow(a, c);
			c += 0.5;
			if( c > 1 ) {
				a += 0.5;
				c = -0.5;
			}
			if( a <= 1 && c <= 1 ) {
				setTimeout(generateRowTimeout, 100);
			}
		}; 
		setTimeout(generateRowTimeout);
	}
	
	require(['togos-game21/QuaternionDemo', 'togos-game21/Quaternion', 'togos-game21/materials'], function(_QuaternionDemo, _Quaternion, _materials) {
		QuaternionDemo = _QuaternionDemo.default;
		Quaternion = _Quaternion.default;
		quaternionDemo = new QuaternionDemo();
		generateSomeImages();
	});
})();
</script>

</body>
</html>
