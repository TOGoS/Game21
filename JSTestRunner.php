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
	
	var testCompleted = function(testName, success, errors) {
		if( success ) {
			++passedTestCount;
		} else {
			++failedTestCount;
			var errorMessages = [];
			for( var i in errors ) {
				var error = errors[i];
				console.error(error);
				errorMessages.push( error.message+(error.stack ? "\n"+error.stack : " (no stack available)") );
			}
			updateDebugText(testName+" failed: "+errorMessages.join("\n"));
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
				try {
					require([testModName], function(testMod) {
						testNameElem.firstChild.nodeValue = testModName;
						console.log("Loaded "+testModName+"...");
						Promise.all(testing.flushRegisteredTestResults()).
							then( (allResults) => {
								let errors = [];
								for( var r in allResults ) {
									if( allResults[r].errors && allResults[r].errors.length > 0 ) {
										for( e in allResults[r].errors ) errors.push( allResults[r].errors[e] );
									}
									if( allResults[r].failures && allResults[r].failures.length > 0 ) {
										for( e in allResults[r].failures ) errors.push( { tfType: "failure", message: allResults[r].failures[e].message } );
									}
								}
								testCompleted(testModName, errors.length == 0, errors)
							} ).
							catch( (err) => testCompleted(testModName, false, [err]) ).
							then( () => testModules(moduleNames.slice(1)) );
					});
				} catch( err ) {
					testCompleted(testModName, false, [err]);
					testModules(moduleNames.slice(1));
				}
			});
		}
		
		testModules(testModNames).then( () => { console.log("All tests finished."); } );
	});
})(); 

//]]></script>

</body>
</html>
