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
	'showInstructions' => [
		'valueType' => 'boolean',
		'defaultValue' => true,
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
<title><?php eht($title); ?></title>
</head>
<body>

<style scoped>
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
	/* I'd really like to fix height at 90% of viewport, but 'vh' doesn't seem to work in my browser */
	height: 600px;
	margin: 16px 0px;
	padding: 16px 0px;
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
	flex-shrink: 0;
	overflow: auto;
}
.shape-views > * {
	margin: 0px 8px;
}
#shape-editor-ui #messages {
	background: #001;
	color: silver;
	overflow: auto;
	flex-grow: 1;
	flex-shrink: 1;
	overflow: auto;
	padding: 4px 8px;
}
button { margin: 0; }
.error {
	color: red;
}
code {
	color: yellow;
}
samp {
	font-style: italic;
	color: lime;
}
p, ul {
	padding-top: 6px;
	padding-bottom: 6px;
}
</style>

<?php if($showInstructions): ?>
<p>I've made a Procedural Shape Editor!
By 'editor' I mean a text area that you can type programs into
and some canvases to show the result.  It's rudimentary
but it means that it's at least <em>possible</em> for people
to come up with some interesting models while I go and work
on other stuff.</p>

<p>Scroll down for instructions.</p>
<?php endif; ?>

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
<canvas id="static2-view" class="shape-view"
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

<div>
<button onclick="shapeEditor.randomizeLights()">Randomize lights</button>
<button onclick="shapeEditor.resetLights()">Reset lights</button>
</div>

<?php require_game21_js_libs($inlineResources, array('togos-game21/ClientRegistry','togos-game21/ui/ProceduralShapeEditor')); ?>
<script type="text/javascript">
	require(['togos-game21/ClientRegistry','togos-game21/ui/ProceduralShapeEditor'], function(_ClientRegistry,_ProceduralShapeEditor) {
		var ProceduralShapeEditor = _ProceduralShapeEditor.default;
		var reg = _ClientRegistry.getDemoRegistry();
		var shapeEditor = new ProceduralShapeEditor(reg);
		shapeEditor.initUi();
		shapeEditor.runDemo();
		window.shapeEditor = shapeEditor;
	});
</script>

<?php if($showInstructions): ?>
<p>Shapes are defined using a Forth-like language.
Defining them as a procedure allows us to re-render them at different rotations and
scales and under different lighting conditions and at different points in their animation cycle
(for animated shapes).</p>

<p>The end result of the Forth program is a 'shape sheet',
which consists of a material index and corner depths for each pixel.
This shape sheet can then be rendered as an RGB image by providing
materials for each material index and a set of lights.</p>

<p>This means we could, for instance, swap out steel for copper
without having to re-run the Forth script.</p>

<aside>
Not that that's <em>terribly</em> useful.
I designed that feature before I decided that most objects would be rendered procedurally anyway.
</aside>

<p>The text area on the left is where you write your script.
Hit 'compile' to compile it and update the shape views on the right.
If there are errors they'll be printed to your browser's console.
You can drag around the shape views to change the rotation,
use the scroll wheel to zoom in and out,
and use the '&#x23f8'/'&#x25b6;' button to toggle auto-rotation.</p>

<p>The second preview does 4x supersampling, which is why
it takes longer to render than the others.</p>

<p>Now I will try to describe the language.</p>

<p>Similar to traditional Forth, words are delimited by whitespace,
literal numbers push themselves onto the data stack, <code>:</code> starts
a word definition, <code>dup</code>, <code>drop</code>, <code>swap</code>,
and <code>pick</code> have their traditional meanings.
<code>;</code> inserts an <code>exit</code> (return) and marks the end of word definitions;
anything outside of a function definition is run immediately at the beginning of the program.
Rational numbers, e.g. <code>1/5</code>, can also be represented literally
(though internally they are just floats).</p>

<p><code>!</code> and <code>@</code> store and fetch values to/from a variable, respectively.
You can define dynamically-scoped variables using the <code>context-variable:</code> word.
A few context variables have special meaning, but you still need to declare them
to use them.</p>

<ul>
<li><code>$t</code> is the animation phase, a number [0-1) indicating
the point in the animation that we're currently drawing.  If your thing isn't animated you can ignore it.</li>

<li><code>$material-index</code> is the index of the material that will be plotted
when you <code>plot-sphere</code> or <code>fill-polygon</code>.</li>
</ul>

<p>Drawing is done by transforming the 'cursor' by translating, rotating, and scaling, and plotting spheres or polygons.
Cursor transformations are always relative to and alter the current transformation.
e.g. if you move by 3,0,0, scale by 2, and then move by 0,1,0, the cursor will be at 3,2,0,
and a sphere plotted with size=1 will actually have radius=2 relative to the original coordinate system.</p>

<p>The initial coordinate system is +x = right, +y = down, and +z = into the screen.
One unit = one meter.
I expect standard-sized blocks in the game to be 1m by 1m, with bounds from -0.5,-0.5,-0.5 to +0.5,+0.5,+0.5,
so if you want to design a block-sized thing, keep it approximately within those bounds.</p>

<h3>Words</h3>

<p>Listed with (parameters and -- return values)</p>

<h4>Cursor transformations</h4>

<ul>
<li><code>move</code> (x y z --) move the 'cursor' by the specified amount.</li>
<li><code>scale</code> (scale --) scale the cursor by some amount.</li>
<li><code>aarotate</code> (x y z ang --) rotate the cursor by some amount.</li>
</ul>

<h4>Drawing</h4>

<ul>
<li>plot-sphere</code> (radius --) plot a sphere of the specified radius at the cursor position.</li>
<li>open-polygon</code> (--) start drawing a polygon at the cursor position.</li>
<li>polygon-point</code> (--) add an additional polygon vertex.</li>
<li>fill-polygon</code> (--) add an additional point and fill the polygon.</li>
</ul>

<p>Back sides of polygons will not be drawn.
The 'front' side is the side that appears to be drawn clockwise.</p>

<h4>Context loading/saving</h4>

<ul>
<li><code>save-context</code> (--) save the current context (transformation, material index, polygon points) to the context stack.</li>
<li><code>restore-context</code> (--) replace the current context with one popped off the context stack.</li>
<li><code>!</code> (value variable --) save a value into a context variable.</li>
<li><code>@</code> (variable -- value) retrieve a value from a context variable.</li>
</ul>

<h4>Jumps</h4>

<ul>
<li><code>jump</code> (location --) jump to the program location popped from the top of the data stack.</li>
<li><code>call</code> (location --) push the address of the next instruction to the return stack jump to the program location popped from the top of the data stack.</li>
<li><code>jump-if-zero</code> (value location --) jump to the specified location if value is zero.</li>
<li><code>jump-if-nonzero</code> (value location --) jump to the specified location if value is not zero.</li>
<li><code>exit</code> (--) pop the return location off the return stack and jump to it.</li>
<li><code>&gt;r</code> (value --) pop a value off the data stack and push it onto the return stack.</li>
<li><code>r&gt;</code> (-- value) pop a value off the return stack onto the data stack.</li>
</ul>

<p>There will also be <code>jump:<samp>label</samp></code> and <code>$<samp>label</samp></code>
variants of any user-defined wors that jump to and push the location of any user-defined words.</p>

<p>You can play 2/3 Tower of Hanoi by shuffling data between the data and return stacks.</p>

<h4>Arithmetic</h4>

<ul>
<li><code>+</code>, <code>-</code>, <code>*</code>, <code>/</code>, <code>**</code> (a b -- c) add, substract, multiply, divide, and exponentiate, respectively.</li>
</ul>

<h4>Trigonometry</h4>

<ul>
<li><code>sin</code>, <code>cos</code> (a -- b)</li>
</ul>

<h4>Comparison</h4>

<ul>
<li><code>&lt;</code>, <code>&lt;=</code>, <code>=</code>, <code>&gt;=</code>, <code>&gt;</code> (a b -- c) less than, less than or equal, equal, greater or equal, greater.
<code>-1</code> is pushed onto the stack if true, <code>0</code> otherwise.</li>
</ul>

<h4>Stack operations</h4>

<ul>
<li><code>drop</code> (a --) throw away the topmost value on the stack.</li>
<li><code>dup</code> (a -- a a) duplicate the top stack value.</li>
<li><code>swap</code> (a b -- b a)</li>
<li><code>pick</code> (x ... n -- x) duplicate the <samp>n</samp>th value from the stack (n=0 being the value directly under <samp>n</samp>) onto the top of the stack.</li>
</ul>

<h4>Definition words</h4>

<p>These are interpreted at compile-time rather than run-time, and don't use the stack.
Any arguments tend to be symbolic and come <em>after</em> the word.</p>

<ul>
<li><code>context-variable: $<samp>variablename</samp></code> - declare a context variable.
  After this, <code>$<samp>variablename</samp></code> will refer to the variable itself,
  and <code><samp>variablename</samp></code> can be used as shorthand for getting the variable's value onto the stack.</li>
<li><code>alias: <samp>newname</samp> <samp>oldname</samp></code> - create an alias for a word.
  e.g. <code>alias: jz jump-if-zero</code> if you're going to be <code>jump-if-zero</code>ing a lot
  and get tired of typing it out.</li>
<li><code>code-label: <samp>label</samp></code> - declare a code label.  This allows you to refer to code labels
  that aren't yet defined.</li>
<li><code>: <samp>label</samp></code> - start defining a word or define a code label (they're the same thing).</li>
<li><code>;</code> - stop defining words and continue defining the top-level program.</li>
</ul>

<h3>Materials</h3>

<p>There are only a few defined.</p>

<ul>
<li><code>0</code>-<code>3</code> - reserved for special meanings</li>
<li><code>4</code>,<code>5</code> - gray steel</li>
<li><code>6</code> - black steel</li>
<li><code>8</code>,<code>9</code> - pink stone</li>
<li><code>12</code>-<code>15</code> - foliage</li>
<li><code>16</code>-<code>20</code> - tree bark</li>
</ul>

<p>I usually <code>: mati! $material-index ! ;</code> so that I can just type
<code><samp>material-number</samp> mati!</code> to set the current material rather
than the whole <code>$material-index</code> rigamarole.</p>

<p>Eventually one would be able to define custom materials and indicate your preferred
palette in your script, but that's for another day.</p>

<p>I probably forgot some things.  You can ask me questions if you want.</p>

<?php endif; ?>

</body>
</html>
