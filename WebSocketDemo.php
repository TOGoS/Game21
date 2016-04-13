<?php require_once 'lib.php'; ?>
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
</head>
<body>

<form onsubmit="return false" id="the-form">
<label>Server Address <input type="text" name="serverAddress" value="ws://localhost:4080/router" title="Router WebSocket address"/></label><br />
<label>Binary packets <input type="checkbox" name="binary"/></label><br />
<button onclick="wsClientPage.sendPing()">Send Ping</button>
</form>

<?php require_game21_js_libs($inlineResources); ?>
<script type="text/javascript">
	require(['togos-game21/WebSocketClient'], function(_WebSocketClient) {
		var WebSocketClient = _WebSocketClient.default;
		var wsClient = new WebSocketClient();
				
		var WSClientPage = function(form) {
			this.form = form;
		};
		WSClientPage.prototype.connectIfNotConnected = function() {
			wsClient.connectIfNotConnected(this.form.serverAddress.value);
			wsClient.packetEncodingMode = this.form.binary.checked ? "TUN" : "JSON";
			return wsClient;
		}
		WSClientPage.prototype.connect = function() {
			this.connectIfNotConnected();
		}
		WSClientPage.prototype.sendPing = function(form) {
			this.connectIfNotConnected().ping();
		}
		
		window.wsClientPage = new WSClientPage(document.getElementById('the-form'));
	});
</script>

</body>
</html>
