(function() {
"use strict";

//var wsUrl = 'ws://html5rocks.websocket.org/echo';
var wsUrl = 'ws://harold.nuke24.net:4080/echo';

var conn = new WebSocket(wsUrl, ['soap', 'xmpp']);
conn.onopen = function() {
	conn.send('Pingo!');
};
conn.onerror = function(error) {
	console.log("Websocket Error: "+error);
};
conn.onmessage = function(msg) {
	console.log("Received message: "+msg.data);
};

})();
