(function() {
"use strict";

var FPSUpdater = function(counterFunction, element) {
	this.counterFunction = counterFunction;
	this.element = element;
	this.previousCount = 0;
};
FPSUpdater.prototype.update = function() {
	var newCount = (this.counterFunction)();
	var frames = newCount - this.previousCount;
	this.element.nodeValue = frames;
	this.previousCount = newCount;
};
FPSUpdater.prototype.start = function() {
	setInterval( this.update.bind(this), 1000 );
};

window.FPSUpdater = FPSUpdater;

})();
