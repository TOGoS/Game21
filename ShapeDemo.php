<?php

ini_set('display_errors','On');
error_reporting(E_ALL|E_STRICT);

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
	'title' => [
		'valueType' => 'string',
		'defaultValue' => 'Blobs!',
		'affects' => 'pageGeneration',
	],
	'shapeViewMaxWidth' => [
		'valueType' => 'number',
		'defaultValue' => 768,
		'affects' => 'pageGeneration',
	],
	'shapeViewMaxHeight' => [
		'valueType' => 'number',
		'defaultValue' => 384,
		'affects' => 'pageGeneration',
	],
	'width' => [
		'valueType' => 'number',
		'defaultValue' => 192,
		'affects' => 'pageGeneration',
	],
	'height' => [
		'valueType' => 'number',
		'defaultValue' => 96,
		'affects' => 'pageGeneration',
	],
	'inlineResources' => [
		'valueType' => 'boolean',
		'defaultValue' => false,
		'affects' => 'pageGeneration',
	],
	
	# Shape generation
	'grainSize' => [
		'valueType' => 'number',
		'defaultValue' => 2,
		'title' => 'grain size',
		'comment' => 'Scale of wood grain-like texture.',
		'affects' => 'shapeGeneration'
	],
	'simplexScale' => [
		'valueType' => 'number',
		'defaultValue' => 1,
		'title' => 'simplex scale',
		'comment' => 'Scale of simplex noise-based features.',
		'affects' => 'shapeGeneration',
	],
	
	# Rendering
	'shadowDistanceOverride' => [
		'valueType' => 'number',
		'defaultValue' => 30,
		'title' => 'shadow distance override',
		'comment' => 'Maximum screens-space length of shadows.  Enter 0 for no shadows, Infinity for long, hard ones.',
		'affects' => 'rendering',
	],
	'updateRectanglesVisible' => [
		'title' => 'show update rectangles',
		'valueType' => 'boolean',
		'defaultValue' => false,
		'affects' => 'rendering',
	],
	
	# Animation
	'lightRotationEnabled' => [
		'valueType' => 'boolean',
		'defaultValue' => true,
		'affects' => 'animation',
	],
	'lightningEnabled' => [
		'valueType' => 'boolean',
		'defaultValue' => true,
		'affects' => 'animation',
	],
	'zShiftingEnabled' => [
		'valueType' => 'boolean',
		'defaultValue' => true,
		'affects' => 'animation',
	],
	'lavaLampEnabled' => [
		'valueType' => 'boolean',
		'defaultValue' => true,
		'affects' => 'animation',
	],
];

/*
$configDefaults = [
	'title' => 'Blobs!',
	'grainSize' => 2,
	'simplexScale' => 1,
	'inlineResources' => false,
	'width' => 192,
	'height' => 96,
	'shapeViewMaxWidth' => 768,
	'shapeViewMaxHeight' => 384,
	'updateRectanglesVisible' => false,
	'shadowDistanceOverride' => 30,
	'zShiftingEnabled' => true,
	'lavaLampEnabled' => true,
	'lightningEnabled' => true,
	'lightRotationEnabled' => true,
];
*/

$config = config_from_env($configProperties, $config);
extract($config, EXTR_SKIP|EXTR_REFS);

list($shapeViewWidth, $shapeViewHeight) = fitpar($shapeViewMaxWidth, $shapeViewMaxHeight, $width, $height);


$outputParamField = function($paramInfo) use ($config) {
	$name = $paramInfo['name'];
	$paramTitle = isset($paramInfo['title']) ? $paramInfo['title'] : $name;
?>
<div>
	<label<?php if(isset($paramInfo['comment'])) echo ' title="'.htmlspecialchars($paramInfo['comment']).'"'; ?>><?php eht(ucfirst($paramTitle)); ?></label>
<?php if($paramInfo['valueType'] === 'boolean'): ?>
	<input type="checkbox" name="<?php eht($name); ?>"<?php if($config[$name]) echo ' checked'; ?>
		placeholder="<?php eht($paramInfo['defaultValue']); ?>"/>
<?php else: ?>
	<input type="text" name="<?php eht($name); ?>" value="<?php eht($config[$name]); ?>"
		placeholder="<?php eht($paramInfo['defaultValue']); ?>"/>
<?php endif; ?>
</div>
<?php
};

$outputParamFieldsAffecting = function($paramInfos, $affecting) use ($outputParamField) {
	foreach($paramInfos as $name=>$paramInfo) {
		if($paramInfo['affects'] == $affecting) {
			$outputParamField($paramInfo + ['name'=>$name]);
		}
	}
};


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
.main-content {
	min-height: 100%;
	margin: 0;
	display: flex;
	flex-direction: column;
	justify-content: center;
}
.preview-region {
	display: flex;
	align-items: center;
	justify-content: center;
}
canvas.shape-view {
	image-rendering: -moz-crisp-edges;
	image-rendering: pixelated;
}
.adjustment-form {
	color: silver;
}
.adjustment-form input[type="text"],
.adjustment-form input[type="checkbox"] {
	border: 1px inset rgb(128,64,64);
	background: rgb(64,0,0);
	color: white;
}
.adjustment-form input[type="submit"] {
	border: 1px outset darkgray;
	background: darkgray;
	color: rgb(64,0,0);
	font-weight: bold;
	text-shadow: 0px +1px rgba(255,255,255,0.5), 0px -1px rgba(0,0,0,0.5);
}

.adjustment-form .parameters {
	display: table;
}
.adjustment-form .parameters > div {
	display: table-row;
}
.adjustment-form .parameters > div > * {
	display: table-cell;
}
.adjustment-form .parameters > div > *:first-child {
	display: table-cell;
	padding-right: 10px;
}
</style>
<title><?php eht($title); ?></title>
</head>
<body>

<!-- Demo config: <?php echo json_encode($config, JSON_PRETTY_PRINT); ?> -->

<p style="position:fixed; color:white">FPS: <span id="fps-counter">&nbsp;</span></p>

<div class="main-content">
<div class="preview-region">
<canvas id="demo-canvas" class="shape-view"
  width="<?php eht($width); ?>" height="<?php eht($height); ?>"
  style="width: <?php eht($shapeViewWidth); ?>px; height: <?php eht($shapeViewHeight); ?>px"
></canvas>
</div>

<form id="regeneration-form" class="adjustment-form">
<fieldset>
<legend>Shape Generation Parameters</legend>
<div class="parameters">
<?php $outputParamFieldsAffecting( $configProperties, 'shapeGeneration' ); ?>
</div>
<input type="submit" value="Regenerate"/>
</fieldset>
</form>

<form id="rendering-form" action="#" class="adjustment-form">
<fieldset>
<legend>Rendering Parameters</legend>
<div class="parameters">
<?php $outputParamFieldsAffecting( $configProperties, 'rendering' ); ?>
</div>
</fieldset>
<fieldset>
<legend>Animation Parameters</legend>
<div class="parameters">
<?php $outputParamFieldsAffecting( $configProperties, 'animation' ); ?>
</div>
</fieldset>
</form>
</div>

<?php require_game21_js_libs($inlineResources);; ?>
<script type="text/javascript">
	require(['togos-game21/ShapeSheetDemo'], function(_ShapeSheetDemo) {
		var canv = document.getElementById('demo-canvas')
		var shapeSheetDemo = _ShapeSheetDemo.buildShapeDemo(canv);
		var regenForm = document.getElementById('regeneration-form');
		
		var regenerate = function() {
<?php
foreach($configProperties as $name=>$paramInfo)
	if($paramInfo['affects'] == 'shapeGeneration') {
		echo "\t\t", "shapeSheetDemo.{$name} = ";
		if( $paramInfo['valueType'] == 'boolean' ) {
			echo "regenForm.{$name}.checked";
		} else {
			echo "parseFloat(regenForm.{$name}.value)";
		}
		echo ";\n";
}
?>
			shapeSheetDemo.shapeSheet.initBuffer();
			shapeSheetDemo.buildDensityFunctionDemoShapes();
		};
		
		regenForm.addEventListener('submit', function(evt) {
			evt.preventDefault();
			regenerate();
		});
		
		var renderForm = document.getElementById('rendering-form');
		renderForm.addEventListener('submit', function(evt) {
			evt.preventDefault();
		});
		for( var e=0; e < renderForm.elements.length; ++e ) (function(){
			var input = renderForm.elements.item(e);
			var setVal = function(newValue) {
				var oldValue = shapeSheetDemo[input.name];
				if( typeof(oldValue) == 'number' ) {
					// Otherwise things that should be numbers go in as strings
					// and cause all sorts of chaos and it's awful.
					if( typeof(newValue) === 'string' ) {
						newValue = newValue.trim();
						if( newValue === '' ) newValue = 0;
					}
					newValue = parseFloat(newValue);
				}
				shapeSheetDemo[input.name] = newValue;
			};
			var updateVal = function() {
				var newValue = input.type == 'checkbox' ? input.checked : input.value;
				setVal(newValue);
			};
			input.addEventListener('change', function(evt) {
				updateVal();
			});
			// Do it now, too.
			updateVal();
		})();
		
		shapeSheetDemo.shifting = <?php ejsv($zShiftingEnabled); ?>;
		
		regenerate();
		shapeSheetDemo.startLightRotation();
		shapeSheetDemo.startLavaLamp();
		shapeSheetDemo.startLightning();
	});
</script>
<script type="text/javascript">
</script>

<?php if($lightningEnabled): ?>
<audio src="http://music-files.nuke24.net/uri-res/raw/urn:sha1:BK32QIASOGQD4AE5BV36GDO7JDBDDS7T/thunder.mp3" type="audio/mpeg" autoplay="autoplay" loop="loop"/>
<?php endif; ?>

</body>
</html>
