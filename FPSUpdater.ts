export default class FPSUpdater {
	protected previousCount:number;
	constructor(protected counterFunction:()=>number, protected element:Node) {
		this.previousCount = 0;
	};
	update() {
		var newCount = (this.counterFunction)();
		var frames = newCount - this.previousCount;
		this.element.nodeValue = ""+frames;
		this.previousCount = newCount;
	}
	start() {
		setInterval( this.update.bind(this), 1000 );
	}
};
