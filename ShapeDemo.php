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
	'simplexOctaves' => [
		'valueType' => 'number',
		'defaultValue' => 1,
		'title' => 'simplex octaves',
		'comment' => 'Number of levels of simplex noise (higher = more detail).',
		'affects' => 'shapeGeneration',
	],
	'densityFunctionIterations' => [
		'valueType' => 'number',
		'defaultValue' => 20,
		'title' => 'density function iterations',
		'comment' => 'Number of iterations to do while solving density functions.',
		'affects' => 'shapeGeneration',
	],
	'densityFunctionStartZ' => [
		'valueType' => 'number',
		'defaultValue' => null,
		'title' => 'density function start Z',
		'comment' => 'Z position from which to start tracing density functions (leave empty to guess based on size of thing).',
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

<!-- Config: <?php echo json_encode($config, JSON_PRETTY_PRINT); ?> -->

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

<audio id="thunder-audio"  autoplay="autoplay" loop="loop" volume="<?php $lightningEnabled ? 1 : 0; ?>"
	src="http://music-files.nuke24.net/uri-res/raw/urn:sha1:BK32QIASOGQD4AE5BV36GDO7JDBDDS7T/thunder.mp3" type="audio/mpeg"/>

<?php require_game21_js_libs($inlineResources);; ?>
<script type="text/javascript">
	require(['togos-game21/ShapeSheetDemo'], function(_ShapeSheetDemo) {
		var canv = document.getElementById('demo-canvas')
		var shapeSheetDemo = _ShapeSheetDemo.buildShapeDemo(canv);
		var regenForm = document.getElementById('regeneration-form');
		
		var configProperties = <?php echo str_replace("\n","\n\t\t", json_encode($configProperties, JSON_PRETTY_PRINT)); ?>;
		
		var parseConfigProp = function(value, name) {
			var prop = configProperties[name];
			if( prop == null ) {
				throw new Error("No such config property: "+name);
				return value; // whatever!
			} else if( prop.valueType == 'number' ) {
				return _ShapeSheetDemo.betterParseNumber(value, prop.defaulValue);
			} else if( prop.valueType == 'boolean' ) {
				return _ShapeSheetDemo.betterParseBoolean(value, prop.defaulValue);
			} else if( prop.valueType == 'string' ) {
				return ""+value;
			} else {
				throw new Error("Unrecognized config property value type: "+prop.valueType);
			}
		}
		
		var updateValueFromFormElement = function(input) {
			var newValue = input.type == 'checkbox' ? input.checked : input.value;
			shapeSheetDemo[input.name] = parseConfigProp(newValue, input.name);
		};
		
		var regenerate = function() {
			for( var name in configProperties ) {
				var propInfo = configProperties[name];
				if( propInfo.affects === 'shapeGeneration' ) {
					var input = regenForm[name];
					if( input != null ) updateValueFromFormElement(input);
				}
			}
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
			if( !input.name ) return;
			input.addEventListener('change', function(evt) {
				updateValueFromFormElement(input);
			});
			// Do it now, too.
			updateValueFromFormElement(input);
		})();
		
		shapeSheetDemo.shifting = <?php ejsv($zShiftingEnabled); ?>;
		
		regenerate();
		shapeSheetDemo.startLightAnimation();
		shapeSheetDemo.startLavaLamp();
		let thunderAudio = document.getElementById('thunder-audio');
		shapeSheetDemo.on('lightTick', () => {
			if( shapeSheetDemo.lightningEnabled && thunderAudio.volume < 1 ) {
				thunderAudio.volume += 1/256;
			} else if( !shapeSheetDemo.lightningEnabled && thunderAudio.volume > 0 ) {
				thunderAudio.volume -= 1/256;
			}
		})
	});
</script>
<script type="text/javascript">
</script>

</body>
</html>
