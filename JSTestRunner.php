<?php
	require_once ($rp = '.').'/demos/lib.php';
	
	if( !isset($title) ) $title = "JS Tests";
	if( !isset($inlineResources) ) $inlineResources = false;
	if( !isset($width ) ) $width  = isset($_REQUEST['width' ]) ? $_REQUEST['width' ] : 256;
	if( !isset($height) ) $height = isset($_REQUEST['height']) ? $_REQUEST['height'] : 256;
	
?>
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
	.success { color: green; }
	.failure { color: red; }
</style>
<title><?php eht($title); ?></title>
</head>
<body>

<p id="result">Running...</p>
<pre id="debug">&nbsp;</pre>

<?php require_game21_js_libs($inlineResources); ?>
<script type="text/javascript">//<![CDATA[
(function() {
	var testModNames = <?php ejsv(array_values(find_ts_test_modules())); ?>;
	var totalTestCount = testModNames.length;
	var runTestCount = 0;
	var passedTestCount = 0;
	var failedTestCount = 0;
	var errors = [];
	
	var resultElem = document.getElementById('result');
	var debugElem = document.getElementById('debug');
	var debugLines = ["Tests: "+testModNames.join(', ')];
	var updateDebugText = function(line) {
		if( line != null ) debugLines.push(line);
		debugElem.firstChild.nodeValue = debugLines.join("\n");
	}
	updateDebugText();
	
	var testCompleted = function(testName, success, error) {
		if( success ) {
			++passedTestCount;
		} else {
			++failedTestCount;
			errors.push(error);
			updateDebugText(testName+" failed: "+error.message);
			console.log(error);
		}
		if( ++runTestCount == totalTestCount ) {
			if( failedTestCount == 0 ) {
				resultElem.className = 'success';
				resultElem.firstChild.nodeValue = "All "+passedTestCount+" tests passed!";
			} else {
				resultElem.className = 'failure';
				resultElem.firstChild.nodeValue = failedTestCount+" tests failed!";
			}
		}
	};
	
	for( var m in testModNames ) {
		var modName = testModNames[m];
		(function() {
			var testModName = modName; 
			require([testModName], function(testMod) {
				// TODO: may have enqueued async tests;
				// look at registered tests somehow.
				testCompleted(testModName, true);
			}, function(err) {
				testCompleted(testModName, false, err);
			});
		})();
	}
})(); 

//]]></script>

</body>
</html>
