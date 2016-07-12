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
		'defaultValue' => 'Procedural Shape Editor',
		'affects' => 'pageGeneration',
	],
	'shapeViewMaxWidth' => [
		'valueType' => 'number',
		'defaultValue' => 256,
		'affects' => 'pageGeneration',
	],
	'shapeViewMaxHeight' => [
		'valueType' => 'number',
		'defaultValue' => 256,
		'affects' => 'pageGeneration',
	],
	'width' => [
		'valueType' => 'number',
		'defaultValue' => 128,
		'affects' => 'pageGeneration',
	],
	'height' => [
		'valueType' => 'number',
		'defaultValue' => 128,
		'affects' => 'pageGeneration',
	],
	'inlineResources' => [
		'valueType' => 'boolean',
		'defaultValue' => false,
		'affects' => 'pageGeneration',
	],
	'demoScripts' => [
		'valueType' => 'list[string]',
		'defaultValue' => [
			'urn:sha1:XQITK7DNBNJI6LEKM4LK2JI754YXV7TW' => 'Wiggly Thing',
			'urn:sha1:SZN7TKEMMWHGUK7I5SMBZ7ICBR5CFUCU' => 'Bumpy Cube',
			'urn:sha1:2CK4DYFKC5MVUIZDI37YIQIG7DA3357V' => 'Tree',
		]
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

	font-family: sans-serif;
	color: silver;
}
* {
	margin: 0;
	box-sizing: border-box;
}
input {
	color: white;
	background: black;
	border: 1px solid silver;
}
.script-ref-bar {
	padding: 4px 8px;
}
input[type="text"][readonly="readonly"] {
	border: 1px solid darkgray;
}
.shape-views {
	margin: 0;
	display: flex;
	flex-direction: row;
	flex-wrap: wrap;
	justify-content: center;
}
.shape-views > * {
	margin: 16px;
	display: flex;
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
textarea {
	border: 1px solid silver;
	color: white;
	background: black;
}

#shape-editor-ui {
	display: flex;
	flex-direction: row;
	width: 100%;
	height: 100%;
	margin: 0;
}
#shape-editor-ui #left {
	height: 100%;
	margin: 0;
	flex-grow: 1;
	display: flex;
	flex-direction: column;
}
#left textarea {
	height: 100%;
	flex-grow: 2;
}
#shape-editor-ui #right {
	display: flex;
	flex-grow: 3;
	flex-direction: column;
}
#shape-editor-ui .shape-views {
	background: #111;
	flex-grow: 1;
	flex-shrink: 1;
	overflow: auto;
}
#shape-editor-ui #messages {
	background: #001;
	color: silver;
	overflow: auto;
	flex-grow: 1;
	flex-shrink: 1;
	overflow: auto;
}
.error {
	color: red;
}
</style>
<title><?php eht($title); ?></title>
</head>
<body>

<!-- Config: <?php echo json_encode($config, JSON_PRETTY_PRINT); ?> -->

<div id="shape-editor-ui">
<div id="left">
<textarea rows="40" cols="40" id="script-text">
alias: &lt;ctx save-context
alias: ctx&gt; restore-context

context-variable: $t # The 'time' variable, [0,1)
context-variable: $flap

: horn # (segmentcount --)
  0.9 scale
  0.5 0 0 0 0 1 flap deg2rad aarotate
  move 1 plot-sphere
  1 - dup $horn jump-if-nonzero
  drop
;

t 180 deg2rad * sin 20 * 10 - $flap !

1 plot-sphere
&lt;ctx 5 horn ctx&gt;
0 1 0 90 deg2rad aarotate
&lt;ctx 8 horn ctx&gt;
0 1 0 90 deg2rad aarotate
&lt;ctx 16 horn ctx&gt;
0 1 0 90 deg2rad aarotate
&lt;ctx 24 horn ctx&gt;
</textarea>
<div>
<button id="compile-button">Compile</button>
<button id="save-button">Save</button>
<button id="load-button">Load...</button>
<button id="pause-button" title="Pause rendering">&#x23f8;</button>
<button id="play-button" title="Resume rendering">&#x25b6;</button>
</div>
</div>

<div id="right">
<div class="script-ref-bar">
  <label for="script-ref-box">Script URN</label>
  <input readonly="readonly" id="script-ref-box" size="50"></input>
</div>

<div id="shape-views" class="shape-views">
<canvas id="static-view-canvas2" class="shape-view"
  width="<?php eht($width); ?>" height="<?php eht($height); ?>"
  style="background: #100; width: <?php eht($shapeViewWidth); ?>px; height: <?php eht($shapeViewHeight); ?>px"
></canvas>

<canvas id="static-view-canvas" class="shape-view"
  width="<?php eht($width); ?>" height="<?php eht($height); ?>"
  style="background: #100; width: <?php eht($shapeViewWidth); ?>px; height: <?php eht($shapeViewHeight); ?>px"
></canvas>

<canvas id="rotatey-view-canvas" class="shape-view"
  width="<?php eht($width); ?>" height="<?php eht($height); ?>"
  style="background: #100; width: <?php eht($shapeViewWidth); ?>px; height: <?php eht($shapeViewHeight); ?>px"
></canvas>
</div>

<div id="messages">
<p>Some scripts to try:</p>
<ul>
<?php foreach($demoScripts as $uri=>$info) {
  if( is_string($info) ) $info = ['title'=>$info, 'uri'=>$uri];
  echo "<li><a href=\"?script-uri=", htmlspecialchars($uri), "\">", htmlspecialchars($info['title']), "</a></li>\n";
} ?>
</ul>
</div>
</div>
</div>

<?php require_game21_js_libs($inlineResources); ?>
<script type="text/javascript">
	require(['togos-game21/ClientRegistry','togos-game21/ui/ProceduralShapeEditor'], function(_ClientRegistry,_ProceduralShapeEditor) {
		var ProceduralShapeEditor = _ProceduralShapeEditor.default;
		var reg = _ClientRegistry.getDemoRegistry();
		var shapeEditor = new ProceduralShapeEditor(reg);
		shapeEditor.initUi();
		shapeEditor.runDemo();
	});
</script>

</body>
</html>
