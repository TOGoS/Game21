<?php require_once 'lib.php'; ?>
<!DOCTYPE html>
<html>
<head>
<style>
* {
	box-sizing: border-box;
}
.console-output {
	width: 100%;
	min-height: 64px;
}
.console-output > p {
	margin: 2px 4px;
	padding: 2px 4px;
}
.console-command-form {
	display: flex;
	flex-direction: row;
	width: 100%;
}
.console-command-form > * {
	margin: 0;
}
.console-command-input {
	border: none;
	border-top: 1px solid darkgray;
	flex-grow: 1;
}
.console-command-submit-button {
	flex-grow: 0;
}
.console-output, .console-command-input {
	background: black;
	color: silver;
	margin: 0;
	padding: 2px 4px;
	font-family: monospace;
}
</style>
<meta charset="utf-8"/>
</head>
<body>

<form onsubmit="return false" id="the-form">
<label>Server Address <input type="text" name="wsServerAddress" value="ws://<?php echo $_SERVER['SERVER_NAME']; ?>:4080/router" title="Router WebSocket address"/></label><br />

<hr />

<label>Our address <input type="text" name="clientIpAddress" value="2001:4978:2ed:4::3" title="Our [virtual] IP address"/></label><br />
<label>Ping target <input type="text" name="pingTargetIpAddress" value="" title="Ping target IP address"/></label><br />

<p>Some targets</p>
<ul>
<li>he.net 2001:470:0:76::2</li>
</ul>

<button onclick="wsClientPage.sendPing()">Send Ping</button>
</form>

<div id="console-area" style="background:purple">
</div>

<?php require_game21_js_libs($inlineResources); ?>
<script type="text/javascript">
	require([
		'togos-game21/sock/WebSocketClient',
		'togos-game21/ui/Console',
		'togos-game21/inet/IP6Address'
	], function(
		_WebSocketClient,
		_Console,
		_IP6Address
	) {
		var shell = new _Console.ShellProcess();
		shell.document = document;
		shell.defineCommand('echo', function(argv, proc) {
			proc.printLine(0, argv.slice(1).join(" "));
			proc.exit(0);
		});
		window.shellProc = shell;
		document.getElementById('console-area').appendChild(shell.initUi());
		
		var WebSocketClient = _WebSocketClient.default;
		var wsClient = new WebSocketClient();
		wsClient.console = shellProc;
		
		var WSClientPage = function(form) {
			this.form = form;
		};
		WSClientPage.prototype.connectIfNotConnected = function() {
			wsClient.connectIfNotConnected(this.form.wsServerAddress.value);
			return wsClient;
		}
		WSClientPage.prototype.connect = function() {
			this.connectIfNotConnected();
		}
		WSClientPage.prototype.sendPing = function(form) {
			var wsClient = this.connectIfNotConnected();
			var clientIpStr = this.form.clientIpAddress.value;
			wsClient.localAddress = _IP6Address.parseIp6Address(clientIpStr);
			var targetIpStr = this.form.pingTargetIpAddress.value;
			var targetIp = _IP6Address.parseIp6Address(targetIpStr);
			wsClient.ping(targetIp);
		}
		
		window.wsClientPage = new WSClientPage(document.getElementById('the-form'));
	});
</script>

</body>
</html>
