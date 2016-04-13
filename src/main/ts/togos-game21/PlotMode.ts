enum DepthOp {
	NONE,
	REPLACE,
	BUILD,
	DIG
}

enum MaterialOp {
	NONE,
	REPLACE
}

class PlotMode {
	constructor(public depthOp:DepthOp, public materialOp:MaterialOp) { } 
	
	public static DEFAULT = new PlotMode(DepthOp.BUILD, MaterialOp.REPLACE);
};

export default PlotMode;
