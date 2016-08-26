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
	'inlineResources' => [
		'valueType' => 'boolean',
		'defaultValue' => false,
		'affects' => 'pageGeneration',
	],
	'browserVirtualNetwork' => [
		'defaultValue' => '2001:4978:2ed:4::/64',
		'valueType' => 'string',
		'affects' => 'pageGeneration',
	],
	'webSocketUrl' => [
		'defaultValue' => "ws://{$_SERVER['SERVER_NAME']}:4080/router",
		'valueType' => 'string',
		'affects' => 'pageGeneration'
	],
];

$config = config_from_env($configProperties, $config);
extract($config, EXTR_SKIP|EXTR_REFS);

function randAddressPostfix() {
	$parts = [];
	for( $i=0; $i<4; ++$i ) {
		$parts[] = dechex(mt_rand(0,65536));
	}
	return implode(':', $parts);
}

list($vnPrefix,$vnPrefixLength) = explode('/', $browserVirtualNetwork);
$browserVirtualAddress = '::'; //$vnPrefix.randAddressPostfix();

?>
<!DOCTYPE html>
<html>
<head>
<style>
* {
	box-sizing: border-box;
}
.console-output {
	width: 100%;
	max-height: 60vh;
	height: 500px;
	overflow: auto;
}
.console-output > * {
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

<h2>IP6 over WebSocket</h2>

<form onsubmit="return false" id="the-form">
<label>Tunnel Server Address <input type="text" name="wsServerAddress" size="60" value="<?php eht($webSocketUrl); ?>" title="Router WebSocket address"/></label>
<button id="connect-button" onclick="wsClientPage.connect()">Connect</button>
<br />

<hr />

<label>Ping target <input type="text" name="pingTargetIpAddress" size="50" value="2001:470:0:76::2" title="Ping target IP address"/></label>
<button id="ping-button" onclick="wsClientPage.sendPing()">Send Ping</button><br />

<!-- p>Some targets</p>
<ul>
<li>he.net 2001:470:0:76::2</li>
</ul -->

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
		var wsClientPage;
		var wsClient;
		
		shell.document = document;
		shell.defineCommand('echo', function(argv, proc) {
			proc.printLine(0, argv.slice(1).join(" "));
			proc.exit(0);
		});
		shell.defineCommand('ping', function(argv, proc) {
			var pingTarget = argv[1];
			if( !pingTarget ) {
				proc.printLine(1, "Usage: ping <target IP address>");
				proc.exit(1);
				return;
			}
			try {
				var targetIp = _IP6Address.parseIp6Address(pingTarget);
			} catch( err ) {
				proc.printLine(1, "Error: invalid IP6 address '"+pingTarget+"': "+err.message);
				proc.exit(1);
				return;
			}
			wsClient.ping(targetIp);
			proc.exit(0);
		});
		shell.defineCommand('disconnect', function(argv,proc) {
			wsClient.disconnect();
			proc.exit(0);
		});
		window.shellProc = shell;
		document.getElementById('console-area').appendChild(shell.initUi());
		
		var WebSocketClient = _WebSocketClient.default;
		var wsClient = new WebSocketClient();
		wsClient.logger = shellProc;
		
		var WSClientPage = function(form) {
			this.form = form;
			this.connectButton = document.getElementById("connect-button");
			this.pingButton = document.getElementById("ping-button");
		};
		WSClientPage.prototype.connectIfNotConnected = function() {
			wsClient.connectIfNotConnected(this.form.wsServerAddress.value);
			return wsClient;
		}
		WSClientPage.prototype.connect = function() {
			this.connectIfNotConnected();
		}
		WSClientPage.prototype.setConnected = function(connected) {
			if( connected ) {
				this.pingButton.disabled = "";
				this.form.wsServerAddress.disabled = "disabled";
				this.connectButton.disabled = "disabled";
			} else {
				this.pingButton.disabled = "disabled";
				this.form.wsServerAddress.disabled = "";
				this.connectButton.disabled = "";
			}
		}
		WSClientPage.prototype.connect = function() {
			var wsClient = this.connectIfNotConnected();
		}
		WSClientPage.prototype.sendPing = function() {
			var wsClient = this.connectIfNotConnected();
			var targetIpStr = this.form.pingTargetIpAddress.value;
			var targetIp = _IP6Address.parseIp6Address(targetIpStr);
			wsClient.ping(targetIp);
		}
		
		window.wsClientPage = wsClientPage = wsClient.wsClientPage =
			new WSClientPage(document.getElementById('the-form'));
		wsClientPage.setConnected(false);
	});
</script>

</body>
</html>
