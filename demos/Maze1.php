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

require_once __DIR__.'/lib.php';

$configProperties = [
	'asPlogEntry' => [
		'valueType' => 'string',
		'defaultValue' => '',
		'affects' => 'pageGeneration',
	],
	'inlineResources' => [
		'valueType' => 'boolean',
		'defaultValue' => function($config) { return !empty($config['asPlogEntry']); },
		'affects' => 'pageGeneration',
	],
	'width' => [
		'valueType' => 'number',
		'defaultValue' => 320,
		'affects' => 'pageGeneration',
	],
	'height' => [
		'valueType' => 'number',
		'defaultValue' => 240,
		'affects' => 'pageGeneration',
	],
	'pageTitle' => [
		'valueType' => 'string',
		'defaultValue' => 'Maze',
		'affects' => 'pageGeneration',
	],
	'saveGameRef' => [
		'valueType' => 'string',
		'defaultValue' => null,
		'affects' => 'pageGeneration',
	],
	'tabSwitchesMode' => [
		'valueType' => 'boolean',
		'defaultValue' => function($config) { return $config['asPlogEntry'] != '21'; },
		'affects' => 'pageGeneration',
	],
	'includeFakeContent' => [
		'valueType' => 'boolean',
		'defaultValue' => false,
		'affects' => 'pageGeneration',
	],
	'fillScreen' => [
		'valueType' => 'boolean',
		'defaultValue' => function($config) { return !$config['includeFakeContent'] && !$config['asPlogEntry']; },
		'affects' => 'pageGeneration',
	],
];

$config = config_from_env($configProperties, $config);
extract($config, EXTR_SKIP|EXTR_REFS);

?>
<?php if($asPlogEntry == '21'): ?>
date: 2016-10-27
subject: Random mazes
thumnail-image-url: http://picture-files.nuke24.net/uri-res/raw/urn:bitprint:YWNEXCEUE3SMXYA7EAI4CSUNPBEZXW62.KSFA52RQC46ZVQDXX4IPUIBHTZKDIG3D5O4UNKY/RandomCave.png
<?php else: ?>
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title><?php eht($pageTitle); ?></title>
</head>
<body>
<?php endif; ?>

<style scroped>/* <![CDATA[ */
html, body {
	background: black;
	margin: 0;
	padding: 0;
	color: white;
	box-sizing: border-box;
	
	font-family: sans-serif;
}
p, ul {
	margin: 0;
	padding: 4px 8px;
}
ul {
	padding-left: 24px;
}
.game-interface {
	display: flex;
	width: 100%;
<?php if($fillScreen): ?>
	height: 100vh;
<?php endif; ?>
	flex-direction: column;
	justify-content: space-around;
	background: black;
	border-top: 2px solid darkgray;
	border-bottom: 2px solid darkgray;
	margin: 8px 0 8px 0;
}
.game-interface:focus {
	border-top: 2px solid lightgray;
	border-bottom: 2px solid lightgray;
}
.maze-area {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
}
.maze-canvas {
	background: black;
	border: none;
	width: 320px;
	height: 240px;
	box-sizing: content-box;
	image-rendering: pixelated;
}

ul.tile-palette {
	display: flex;
	flex-direction: row;
	justify-content: left;
	margin: 0; padding: 0;
	list-style-type: none;
}
ul.tile-palette li {
	margin: 2px;
	border: 1px solid #444;
	padding: 2px;
	box-sizing: content-box;
	width: 32px;
	height: 32px;
	background-origin: content-box;
	background-size: contain;
	background-position: center;
	background-repeat: no-repeat;
	image-rendering: pixelated;
}
ul.tile-palette li.selected {
	border-color: #FFF;
}
.button-bar {
	display: flex;
	flex-direction: row;
	justify-content: flex-start;
	align-items: center;
}
.button-bar > fieldset {
	display: table-row;
	flex-direction: row;
	justify-content: flex-start;
	flex-basis: content;
	border: none;
	margin: 0;
	padding: 0;
}
.button-bar > fieldset > * {
	display: table-cell;
}
.button-bar > *:nth-child(n+2) {
	margin-left: 8px;
}

.dialog-box {
	position: fixed;
	z-index: 1;
	
	border: 1px solid #666;
	padding: 0;

	display: flex;
	flex-direction: column
}
.dialog-box-content {
	flex-grow: 1;
	display: flex;
	flex-direction: column;
	overflow: auto;
}
.help-box-content {
	background: rgba(0,0,0,0.75);
	padding: 4px 8px;
	overflow: auto;
}
.dialog-box-header {
	display: flex;
	margin: 0; padding: 0;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;

	flex-basis: content;
	flex-shrink: 0;
	
	background: #444;
}
.dialog-box-header button {
	margin: 16px;
}
.dialog-box h3 {
	margin: 0;
	padding: 16px;
	font-size: 18px;
	font-family: sans-serif;
}
.big-dialog-box {
	top: 10vh;
	left: 10vw;
	height: 80vh;
	width: 80vw;
}

.dialog-text-area {
	background: rgba(0,0,0,0.6);	
	color: white;
	margin: 0px;
	padding: 4px 8px;
	overflow-y: auto;
	box-sizing: border-box;
}

#load-list {
	flex-grow: 1;
	list-style-type: none;
}
#load-list li {
	margin: 0;
	padding: 2px 4px;
	cursor: pointer;
}
#load-list li:hover {
	text-decoration: underline;
}

#console-output {
	flex-grow: 1;
}
#console-input {
	flex-basis: content;
	flex-shrink: 0;
}

#camera-location-box {
	color: #AA0;
	background: rgba(0,0,0,0.75);
	font-family: monospace;
}

#inventory-dialog {
	position: fixed;
	top: 10vh;
	left: 10vh;
	bottom: 10vh;
	right: 10vh;
	
	display: flex;
	flex-direction: column;
	align-content: left;
}
.storage-compartment-content {
	min-width: 32px;
	min-height: 32px;
	background: rgba(0,0,0,0.5);
	display: flex;
	flex-direction: column;
}
.storage-compartment-content > * {
	margin: 0;
	padding: 2px;
	box-sizing: content-box;
	width: 32px;
	height: 32px;
	background-origin: content-box;
	background-size: contain;
	background-position: center;
	background-repeat: no-repeat;
	image-rendering: pixelated;
	border: 1px solid rgba(64,64,64,0.75);
}
.storage-compartment-content > *.selected {
	border-color: rgba(192,192,192,0.75);
}

@media (min-width: 640px) and (min-height: 500px) {
	.maze-canvas {
		width: 640px;
		height: 480px;
	}
}
@media (min-width: 960px) and (min-height: 740px) {
	.maze-canvas {
		width: 960px;
		height: 720px;
	}
}

#loading-status-box {
	position: fixed;
	top: 0;
	left: 0;
	display: inline-block;
	background: purple;
	color: white;
}

#win-dialog {
	display: flex;
	flex-direction: column;
	background: black;
}
.win-dialog-message-area {
	display: flex;
	flex-direction: column;
	flex-grow: 2;
}
.win-dialog-message-area > p {
	font-size: 36px;
	text-align: center;
	margin: 8px 16px;
}
.win-dialog-button-area {
	display: table-row;
	flex-basis: content;
	flex-grow: 0;
	padding: 8px;
}
/* ]]> */</style>

<div id="loading-status-box">Loading JavaScript...</div>

<?php if($asPlogEntry == '21'): ?>
<p>Justus encouraged me to enter
<a href="https://www.it-talents.de/foerderung/code-competition/code-competition-10-2016">this random dungeon generator</a>
competition, so here's my entry.</p>
<?php endif; ?>
<?php if($includeFakeContent): ?>
<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse
cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat
non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
<?php endif; ?>

<div class="game-interface" id="game-interface" tabindex="0">
<div class="maze-area" id="maze-area" style="position:relative">
<div id="camera-location-box" style="position:absolute; top:0; left:0;"></div>
<canvas class="maze-canvas" id="maze-canvas" width="<?php eht($width); ?>" height="<?php eht($height); ?>"/>
</div>

<div id="tile-palette-area"></div>
<?php if($tabSwitchesMode): ?>
<div id="button-area" class="button-bar"></div>
<?php endif; ?>
</div>

<?php if($asPlogEntry == '21'): ?>
<p>Hit "/" to open the console.  "/level <i>n</i>" to warp to level <i>n</i> ('<i>n</i>' standing for some integer).</p>
<?php endif; ?>

<div id="console-dialog" class="dialog-box big-dialog-box" style="display:none">
  <div class="dialog-box-header">
    <h3>Console</h3>
    <button id="console-close-button">Close</button>
  </div>
  <div class="dialog-box-content">
    <div id="console-output" class="dialog-text-area" style="flex-grow: 1"></div>
    <input id="console-input" class="dialog-text-area"/>
  </div>
</div>

<div id="load-dialog" class="dialog-box big-dialog-box" style="display:none">
  <div class="dialog-box-header">
    <h3>Load</h3>
    <button id="load-cancel-button">Cancel</button>
  </div>
  <div class="dialog-box-content">
    <ul id="load-list" class="dialog-text-area">
    </ul>
  </div>
</div>

<div id="help-dialog" class="dialog-box big-dialog-box" style="display:none">
  <div class="dialog-box-header">
    <h3>About</h3>
    <button id="help-close-button">Close</button>
  </div>
  <div class="dialog-box-content help-box-content">
    <p>W,A,S,D to move around.</p>
	
    <p>Hit the tab key to toggle between edit and play mode.</p>
    
    <p>Hit <kbd>/</kbd> to open the console.</p>
    
    <h4>Console commands</h4>
    
    <p>Note that some editing commands require you to be in edit mode because they rely
    on information that is only given to the client in edit mode.</p> 
    
    <ul>
    <li><code>/load &lt;savegame-ID&gt;</code> - load a save game by URN; note that this URN should end with a "<code>#</code>" and you will need to enclose it in quotes.</li>
    <li><code>/create-room</code> - creates a new room, not connected to any other</li>
    <li><code>/connect-new-room &lt;direction&gt;</code> - create a new room and connect the current room to it in the specified direction.
      Directions are <code>t</code> (top), <code>r</code> (right), <code>b</code> (bottom), <code>l</code> (left), or some combination,
      (for diagonals).  Don't create a new room when a link already exists in that direction,
	  as that will cause trouble (later versions will prevent this from happening).</li>
    <li><code>/connect-rooms &lt;room-A-ID&gt; &lt;direction&gt; &lt;room-B-ID&gt;</code> - connect 2 rooms.</li>
    </ul>
    
    <p>The ID of the room you are currently in is shown at the top of the screen.</p>
	
	<p>There exists a door and a lift in this world that can be controlled with Door/Lift selector
	and the 'Up'/'Down' buttons at the bottom of this page.
	There is currently no way to create new doors or lifts, but with a bit of dedication
	you may be able to move the existing ones.
	In the future doors and lifts should be controllable with switches
	or keys scattered through the maze.</p>
	
	<p>There is no end goal.
	If you'd like there to be one, maybe make a room
	with 'Winner' spelled out in blocks or something.</p>
  </div>
</div>

<div id="inventory-dialog" style="display:none">
</div>

<div id="win-dialog" class="dialog-box big-dialog-box" style="display:none">
<div id="win-dialog-message-area" class="win-dialog-message-area"></div>
<div id="win-dialog-button-area"></div>
</div>

<?php if($includeFakeContent): ?>
<p>But I must explain to you how all this mistaken idea of denouncing pleasure
and praising pain was born and I will give you a complete account of the
system, and expound the actual teachings of the great explorer of the truth,
the master-builder of human happiness.
No one rejects, dislikes, or avoids pleasure itself, because it is pleasure,
but because those who do not know how to pursue pleasure rationally
encounter consequences that are extremely painful.
Nor again is there anyone who loves or pursues
or desires to obtain pain of itself, because it is pain,
but because occasionally circumstances occur in which toil and pain
can procure him some great pleasure.
To take a trivial example,
which of us ever undertakes laborious physical exercise,
except to obtain some advantage from it?
But who has any right to find fault
with a man who chooses to enjoy a pleasure that has no annoying consequences,
or one who avoids a pain that produces no resultant pleasure?</p>

<p>On the other hand, we denounce with righteous indignation and dislike men
who are so beguiled and demoralized by the charms of pleasure of the moment,
so blinded by desire, that they cannot foresee the pain and trouble that are
bound to ensue; and equal blame belongs to those who fail in their duty
through weakness of will, which is the same as saying through shrinking from
toil and pain. These cases are perfectly simple and easy to distinguish.
In a free hour, when our power of choice is untrammelled and when nothing
prevents our being able to do what we like best,
every pleasure is to be welcomed and every pain avoided.
But in certain circumstances and owing to the claims of duty
or the obligations of business it will frequently occur
that pleasures have to be repudiated and annoyances accepted.
The wise man therefore always holds in these matters
to this principle of selection:
he rejects pleasures to secure other greater pleasures,
or else he endures pains to avoid worse pains.
<?php endif; ?>

<?php require_game21_js_libs($inlineResources, array('togos-game21/Maze1')); ?>
<script type="text/javascript">//<![CDATA[
	function updateLoadingStatus(text) {
		var div = document.getElementById('loading-status-box');
		if( text == null || text.length == 0 ) {
			div.style.display = 'none';
			div.firstChild.nodeValue = "";
		} else {
			div.style.display = '';
			div.firstChild.nodeValue = text;
		}
	}

	require(['togos-game21/Maze1'], function(_Maze1) {
		updateLoadingStatus("Importing cache data...");
		
		var cacheStrings = <?php
			$dataCacheFile = $rrp.'/maze1demo-datacache.json';
			if( file_exists($dataCacheFile) ) {
				echo trim(str_replace("\n","\n\t\t", file_get_contents($dataCacheFile)));
			} else {
				echo 'undefined';
			}
		?>;
		
		updateLoadingStatus("Starting...");
		
		var demo = _Maze1.startDemo(document.getElementById('maze-canvas'), <?php ejsv($saveGameRef); ?>, updateLoadingStatus, cacheStrings);
		demo.tabSwitchesMode = <?php ejsv($tabSwitchesMode); ?>;
		window.maze1Demo = demo;
		
		const fogColor = 'rgba(38,38,44,1)';
		demo.view.occlusionFillStyle = fogColor;
		document.getElementById('maze-area').style.background = fogColor;
	});
//]]></script>
<?php if(!$asPlogEntry): ?>

</body>
</html>
<?php endif; ?>
