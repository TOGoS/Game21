(function() {
	var module = window;
	
	var TileLayer = function() {
		this.width = 0;
		this.height = 0;
		this.cells = []; // array of row index => column index => cell element
		this.tbody = null;
	};
	
	var TileView = function() {
		this.tileLayers = [];
	};
	TileView.prototype.initUi = function(viewElement) {
		this.viewElement = viewElement;
	};
	TileView.prototype.getTileLayer = function(layerNumber, w, h) {
		if( this.tileLayers[layerNumber] == null ) {
			this.tileLayers[layerNumber] = new TileLayer();
			var tab = document.createElement('table');
			var tbod = document.createElement('tbody');
			tab.appendChild(tbod);
			this.viewElement.appendChild(tab);
			this.tileLayers[layerNumber].tbody = tbod;
		}
		// TODO: Make sure the width and height are sufficient, etc.
		return this.tileLayers[layerNumber];
		// todo
	};
	
	TileView.prototype.runDemo = function() {
		this.getTileLayer(1);
	}

	module.TileView = TileView;
})();
