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
	var testModuleNames = <?php ejsv(array_values(find_ts_test_modules())); ?>;
	var totalTestCount = testModuleNames.length;
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
	var debugLines = ["Tests:\n\t"+testModuleNames.join(",\n\t"), ''];
	var updateDebugText = function(line) {
		if( line != null ) debugLines.push(line);
		debugElem.firstChild.nodeValue = debugLines.join("\n");
	}
	updateDebugText();
	
	var logErrors = function(testName, errors) {
		var errorMessages = [];
		for( var i in errors ) {
			var error = errors[i];
			console.error(error);
			errorMessages.push( error.message+(error.stack ? "\n"+error.stack : " (no stack available)") );
		}
		updateDebugText(testName+" failed: "+errorMessages.join("\n"));
	}
	
	var testCompleted = function(testName, success, errors) {
		if( success ) {
			++passedTestCount;
		} else {
			++failedTestCount;
			logErrors( testName, errors );
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
			if( moduleNames.length == 0 ) return Promise.resolve();

			return new Promise( function(resolve,reject) {
				var testModuleName = moduleNames[0];
				var moduleTestResults = [];
				
				testing.testHarness = {
					registerTestResult: function(name, resultPromise) {
						moduleTestResults.push({
							moduleName: testModuleName,
							testName: name,
							resultPromise: resultPromise,
						});
					}
				};
				
				try {
					require([testModuleName], function(testMod) {
						testNameElem.firstChild.nodeValue = testModuleName;
						console.log("Loaded "+testModuleName+"...");
						var anyFailuresThisModule = false;
						var allResultsHandled = moduleTestResults.map( function(mtr) {
							return mtr.resultPromise.
								catch( function(err) { return { errors: [err] } } ).
								then( function(tr) {
									if( tr == null ) {
										anyFailuresThisModule = true;
										logErrors(mtr.testModuleName+"/"+mtr.testName, [{message: "Didn't return a testresult!"}]);
										return;
									}
									if( tr.errors && tr.errors.length > 0 ) {
										anyFailuresThisModule = true;
										logErrors( mtr.testModuleName+"/"+mtr.testName, tr.errors );
									}
									if( tr.failures && tr.failures.length > 0 ) {
										anyFailuresThisModule = true;
										logErrors( mtr.testModuleName+"/"+mtr.testName, tr.failures );
									}
								});
						});
						return Promise.all(allResultsHandled).then( function() {
							testCompleted( testModuleName, !anyFailuresThisModule );
							resolve();
						});
					});
				} catch( err ) {
					testCompleted(testModuleName, false, [err]);
					resolve();
				}
			}).then( function() { testModules(moduleNames.slice(1)) } );
		}
		
		testModules(testModuleNames).then( () => { console.log("All tests finished."); } );
	});
})(); 

//]]></script>

</body>
</html>
