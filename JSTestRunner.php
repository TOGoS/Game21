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

<p id="result">Running <span id="test-name">&nbsp;</span><span id="running-dots">...</span></p>
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
	
	var clear = function( elem ) {
		while( elem.firstChild ) elem.removeChild(elem.firstChild);
	}
	
	var resultElem = document.getElementById('result');
	var debugElem = document.getElementById('debug');
	var testNameElem = document.getElementById('test-name');
	var dotsElem = document.getElementById('running-dots');
	var debugLines = ["Tests:\n\t"+testModNames.join(",\n\t"), ''];
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
			testNameElem.firstChild.nodeValue = '';
			dotsElem.firstChild.nodeValue = '';
			if( failedTestCount == 0 ) {
				resultElem.className = 'success';
				resultElem.firstChild.nodeValue = "All "+passedTestCount+" tests passed!";
			} else {
				resultElem.className = 'failure';
				resultElem.firstChild.nodeValue = failedTestCount+" tests failed!";
			}
		}
	};
	
	require(['togos-game21/testing'], function(testing) {
		function testModules( moduleNames ) {
			return new Promise( (resolve,reject) => {
				if( moduleNames.length == 0 ) return Promise.resolve(true);
				
				var testModName = moduleNames[0];
				require([testModName], function(testMod) {
					testNameElem.firstChild.nodeValue = testModName;
					console.log("Loaded "+testModName+"...");
					Promise.all(testing.flushRegisteredTestResults()).
						then( (allResults) => {
							let errorMessages = [];
							for( var r in allResults ) {
								if( allResults[r].errors && allResults[r].errors.length > 0 ) {
									for( e in allResults[r].errors ) errorMessages.push( allResults[r].errors[e].message );
								}
								if( allResults[r].failures && allResults[r].failures.length > 0 ) {
									for( e in allResults[r].failures ) errorMessages.push( allResults[r].failures[e].message );
								}
							}
							testCompleted(testModName, errorMessages.length == 0, {message: errorMessages.join("\n")})
						} ).
						catch( (err) => testCompleted(testModName, false, {message: err}) ).
						then( () => testModules(moduleNames.slice(1)) );
				});
			});
		}
		
		testModules(testModNames).then( () => { console.log("All tests finished."); } );
	});
})(); 

//]]></script>

</body>
</html>
