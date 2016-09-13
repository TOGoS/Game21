var nextConnNumber = 1;

self.addEventListener('connect', function(e) {
	var port = e.ports[0];
	var connNumber = nextConnNumber++;
	port.onmessage = function(evt) {
		port.postMessage("Hello, "+evt.data+", you are using connection number "+connNumber);
	};
});
