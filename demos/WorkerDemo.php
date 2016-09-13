<?php

ini_set('display_errors','On');
error_reporting(E_ALL|E_STRICT);

require_once 'lib.php';

$title = "Web Worker Demo";

?>
<html>
<head>
<meta charset="utf-8"/>
<title><?php eht($title); ?></title>
</head>
<body>

<h2>Web Worker Demo</h2>

<div id="messages">
</div>

<script type="text/javascript">//<![CDATA[
(function(){
	function appendMessage( text, className ) {
		var p = document.createElement('p');
		var messageDiv = document.getElementById('messages');
		p.appendChild(document.createTextNode(text));
		if( className ) p.className = className;
		messageDiv.appendChild(p);
	}
	
	if( window.Worker ) {
		var leWorkeur = new SharedWorker('demoworker.js');
		leWorkeur.port.onmessage = function(msg) {
			appendMessage("Message from worker: "+msg.data);
		};
		leWorkeur.port.postMessage('Todd');
		appendMessage("Ooh, we have Workers!");
	} else {
		appendMessage("No Worker API available!", 'error');
	}
})();
//]]></script>

</body>
</html>
