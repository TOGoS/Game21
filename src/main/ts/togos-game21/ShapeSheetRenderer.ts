import DeepFreezer from './DeepFreezer';
import Rectangle from './Rectangle';
import ShapeSheet from './ShapeSheet';
import SurfaceColor from './SurfaceColor';
import LightColor from './LightColor';
import Material from './Material';
import Vector3D from './Vector3D';
import KeyedList from './KeyedList';
import DirectionalLight from './DirectionalLight';
import {DEFAULT_LIGHTS} from './Lights';
import {DEFAULT_MATERIALS} from './Materials';

const LARGE_NUMBER = 1000;

function vectorXYLength(vect:Vector3D):number {
	return Math.sqrt(vect.x*vect.x + vect.y*vect.y);
};

// fit vector to [-1..1, -1..1, -inf..inf]
function normalizeVect3dToXYUnitSquare(vect:Vector3D):Vector3D {
	var len = Math.max(Math.abs(vect.x), Math.abs(vect.y));
	if( len == 0 ) return vect;
	return vect.scale(1/len);
};

function calcOpacity4(z0:number, z1:number, z2:number, z3:number):number {
	var opac = 1;
	if( z0 === Infinity ) opac -= 0.25;
	if( z1 === Infinity ) opac -= 0.25;
	if( z2 === Infinity ) opac -= 0.25;
	if( z3 === Infinity ) opac -= 0.25;
	return opac;
};
function calcSlope2(z0:number,z1:number):number {
	if( z0 === z1 && (z0 === Infinity || z0 === -Infinity) ) return null; // Indicate to caller not to use this value
	if( z0 === Infinity ) return -Infinity;
	if( z1 === Infinity ) return +Infinity;
	return z1 - z0;
};
function calcSlope4(z0:number,z1:number,z2:number,z3:number):number {
	var s0 = calcSlope2(z0,z1);
	var s1 = calcSlope2(z2,z3);
	if( s0 === null && s1 === null ) {
		return 0; // Should be completely transparent so this won't really matter
	} else if( s0 === null ) {
		return s1;
	} else if( s1 === null ) {
		return s0;
	} else if( s0 === Infinity ) {
		if( s1 === Infinity ) {
			return LARGE_NUMBER;
		} else if( s1 === -Infinity ) {
			return 0;
		} else {
			return s1;
		}
	} else if( s0 === -Infinity ) {
		if( s1 === Infinity ) {
			return 0;
		} else if( s1 === -Infinity ) {
			return -LARGE_NUMBER;
		} else {
			return s1;
		}
	} else {
		if( s1 === Infinity ) {
			return s0;
		} else if( s1 === -Infinity ) {
			return s0;
		} else {
			return (s1 + s0)/2.0;
		}
	}
};

function processRectangleUpdates(rectangleList:Array<Rectangle>, updater:(rect:Rectangle)=>void) {
	var i, r;
	var anythingUpdated = false;
	for( i in rectangleList ) {
		updater(rectangleList[i]);
		anythingUpdated = true;
	}
	rectangleList.splice(0);
	return anythingUpdated;
};

function maybeCombineRectangle(r0:Rectangle, r1:Rectangle):Rectangle {
	const rS = Rectangle.intersection(r0, r1);
	const overlapFactor = rS.area / Math.min(r0.area, r1.area);
	if( overlapFactor > 0 ) {
		return Rectangle.union(r0, r1);
	} else {
		return null;
	}
};
function addToUpdateRectangleList(rectangleList:Array<Rectangle>, rect:Rectangle):Array<Rectangle> {
	if( !rect.isPositiveSize ) return rectangleList;
	const newList:Array<Rectangle> = [];
	for( const i in rectangleList ) {
		const combined = maybeCombineRectangle(rectangleList[i], rect);
		if( combined == null ) {
			newList.push(rectangleList[i]);
		} else {
			rect = combined;
		}
	};
	newList.push(rect);
	return newList;
};


export type Shader = (ssr:ShapeSheetRenderer, region:Rectangle) => void;

declare namespace Object {
	function is(a:any, b:any):boolean;
}

export default class ShapeSheetRenderer {
	public shapeSheet:ShapeSheet;
	public canvas:HTMLCanvasElement;
	public shadowsEnabled:boolean;
	public shaders:Array<Shader>;
	public updatingDepthRectangles:Array<Rectangle>;
	public updatingColorRectangles:Array<Rectangle>;
	public updatingCanvasRectangles:Array<Rectangle>;
	public showUpdateRectangles:boolean;
	public canvasUpdateCount:number;
	public shadowDistanceOverride:number;
	
	protected _materials:Array<Material>;
	protected _lights:KeyedList<DirectionalLight>;
	protected canvasUpdateRequested:boolean;
	protected maxShadowDistance:number;
	
	public cellCoverages:Uint8Array;
	public cellAverageDepths:Float32Array;
	public cellNormals:Float32Array;
	public cellColors:Float32Array;
	public minimumAverageDepth:number;
	
	constructor(shapeSheet:ShapeSheet, canvas:HTMLCanvasElement) {
		this.shapeSheet = shapeSheet;
		
		const cellCount = shapeSheet.area;
		this.cellCoverages       = new Uint8Array(cellCount); // coverage based on depth; 0,1,2,3,4 (divide by 4.0 to get opacity factor)
		this.cellAverageDepths   = new Float32Array(cellCount);
		this.cellNormals         = new Float32Array(cellCount*3); // normal vector X,Y,Z
		this.cellColors          = new Float32Array(cellCount*4); // r,g,b,a of each cell after shading
		
		this.canvas = canvas;
		this.shadowsEnabled = true;
		this.shaders = [];
		this.updatingDepthRectangles  = []; // Tracks rectangles that need to have calculateCellDepthDerivedData called
		this.updatingColorRectangles  = []; // Tracks rectangles that need to have calculateCellColors called
		this.updatingCanvasRectangles = []; // Tracks rectangles that need to be copied to the canvas
		this.maxShadowDistance = Infinity;
		this.showUpdateRectangles = false;
		this.canvasUpdateCount = 0;
		
		// Need to set these last because setting them
		// may rely on other things being initialized
		
		this.materials = DEFAULT_MATERIALS;
		this.lights = DEFAULT_LIGHTS;
		
		this.cellCoverages.fill(0);
		this.minimumAverageDepth = Infinity;
		this.cellAverageDepths.fill(Infinity);
		
		this.dataUpdated(this.shapeSheet.bounds, true, true);
	};
	
	get materials() {
		return this._materials;
	}
	set materials(materials:Array<Material>) {
		this._materials = DeepFreezer.deepFreeze(materials);
		this.materialsUpdated();
	};
	
	get lights():KeyedList<DirectionalLight> { return this._lights; };
	set lights(lights:KeyedList<DirectionalLight>) {
		if( Object.is(lights, this._lights) ) return;
		
		this._lights = DeepFreezer.deepFreeze(lights);
		this.lightsUpdated();
	};

	/**
	 * Slightly more efficient method for updating some lights
	 * (since unchanged ones don't need to be re-normalized) 
	 */
	putLights(updatedLights:KeyedList<DirectionalLight>):void {
		let lights = DeepFreezer.thaw(this._lights);
		for( let i in updatedLights ) {
			lights[i] = DeepFreezer.deepFreeze(updatedLights[i]);
		}
		this.lights = DeepFreezer.deepFreeze(lights, true);
		this.lightsUpdated();
	};
	
	public getCellInfo(x:number, y?:number) {
		const ss = this.shapeSheet;
		const idx = y == null ? (x|0) : (y|0)*ss.width + (x|0);
		if( idx < 0 || idx >= ss.width*ss.height ) return null;
		return {
			materialIndex: ss.cellMaterialIndexes[idx],
			cornerDepths: [
				ss.cellCornerDepths[idx*4+0],
				ss.cellCornerDepths[idx*4+1],
				ss.cellCornerDepths[idx*4+2],
				ss.cellCornerDepths[idx*4+3]
			],
			averageDepth: this.cellAverageDepths[idx],
			color: [
				this.cellColors[idx*4+0],
				this.cellColors[idx*4+1],
				this.cellColors[idx*4+2],
				this.cellColors[idx*4+3]
			]
		};
	};
	
	calculateDepthDerivedData(region:Rectangle) {
		const ss = this.shapeSheet;
		region = Rectangle.intersection( region, ss.bounds );
		const {minX, minY, maxX, maxY} = region.assertIntegerBoundaries();
		
		const isFullRerender = (minX == 0 && minY == 0 && maxX == ss.width && maxY == ss.height);
		
		var i, x, y;
		const cornerDepths = ss.cellCornerDepths;
		const averageDepths = this.cellAverageDepths;
		let minimumAverageDepth = isFullRerender ? Infinity : this.minimumAverageDepth;
		
		const cellCoverages = this.cellCoverages;
		const cellNormals = this.cellNormals;

		for( y=minY; y < maxY; ++y ) for( x=minX, i=ss.width*y+x; x < maxX; ++x, ++i ) {
			let z0 = cornerDepths[i*4+0],
				z1 = cornerDepths[i*4+1],
				z2 = cornerDepths[i*4+2],
				z3 = cornerDepths[i*4+3];
			
			let tot = 0, cnt = 0;
			if( z0 !== Infinity ) { tot += z0; ++cnt; }
			if( z1 !== Infinity ) { tot += z1; ++cnt; }
			if( z2 !== Infinity ) { tot += z2; ++cnt; }
			if( z3 !== Infinity ) { tot += z3; ++cnt; }
			let avg = averageDepths[i] = (cnt == 0) ? Infinity : tot/cnt;
			if( avg < minimumAverageDepth ) minimumAverageDepth = avg;
			
			const opac = calcOpacity4(z0,z1,z2,z3);
			const dzdx = calcSlope4(z0,z1,z2,z3);
			const dzdy = calcSlope4(z0,z2,z1,z3);
			
			let normalX = dzdx;
			let normalY = dzdy;
			let normalZ = -1;
			const normalLength = Math.sqrt(normalZ*normalZ + normalX*normalX + normalY*normalY);
			normalX /= normalLength;
			normalY /= normalLength;
			normalZ /= normalLength;
			
			cellCoverages[i] = opac * 4;
			cellNormals[i*3+0] = normalX;
			cellNormals[i*3+1] = normalY;
			cellNormals[i*3+2] = normalZ;
		}
		
		this.minimumAverageDepth = minimumAverageDepth;
	};

	/**
	 * Updates depth data and also marks the surrounding region
	 * as requiring color updates if max shadow distance is not infinity.
	 * 
	 * The '2' is just to make you read the documentation,
	 * because this system is developing some dangerous temporal coupling.
	 */
	protected updateDepthRectangle2(region:Rectangle):void {
		this.calculateDepthDerivedData(region);
		var msd = this.maxShadowDistance;
		if( this.shadowsEnabled && msd !== Infinity ) {
			this.dataUpdated( region.grow(this.maxShadowDistance), false, true );
		}
	};

	updateDepthDerivedData():void {
		var anythingUpdated = processRectangleUpdates(this.updatingDepthRectangles, this.updateDepthRectangle2.bind(this));
		
		if( anythingUpdated && this.shadowsEnabled && this.maxShadowDistance === Infinity ) {
			// If it's /not/ infinity, then that should have enqueued color regions to be updated.
			// But if it is, we need to recolor the entire thing.
			this.dataUpdated( this.shapeSheet.bounds, false, true );
			//var ss = this.shapeSheet;
			//this.updatingColorRectangles.splice(0, this.updatingColorRectangles.length, [0,0,ss.width,ss.height]);
		}
	};

	calculateCellColors(region:Rectangle):void {
		const ss = this.shapeSheet;
		const width = ss.width, height = ss.height;
		region = Rectangle.intersection( region, ss.bounds );
		const {minX, minY, maxX, maxY} = region.assertIntegerBoundaries();
		
		var i, l, x, y, d;
		var stx, sty, stz, stdx, stdy, stdz; // shadow tracing
		var cellColors = this.cellColors;
		var cellCoverages = this.cellCoverages;
		var cellNormals = this.cellNormals;
		var materials = this.materials;
		var cellMaterialIndexes = ss.cellMaterialIndexes;
		var cellAvgDepths = this.cellAverageDepths;
		var minAvgDepth = this.minimumAverageDepth;
		var lights = this.lights;
		var shadowsEnabled = this.shadowsEnabled;
		var light:DirectionalLight;
		
		for( y=minY; y < maxY; ++y ) for( x=minX, i=width*y+x; x < maxX; ++x, ++i ) {
			var mat = materials[cellMaterialIndexes[i]];
			if( mat == null ) {
				throw new Error("No such material #" + cellMaterialIndexes[i]+" (at cell "+x+","+y+"; index "+i+")");
				//continue;
			}
			// Z being 'into' the picture (right-handed coordinate system!)
			
			var normalX = cellNormals[i*3+0],
				normalY = cellNormals[i*3+1],
				normalZ = cellNormals[i*3+2];
			
			var r = 0, g = 0, b = 0, a = mat.diffuse.a * cellCoverages[i] * 0.25;
			for( l in lights ) {
				light = lights[l];
				var dotProd = -(normalX*light.direction.x + normalY*light.direction.y + normalZ*light.direction.z);
				const shadowDistance = this.shadowDistanceOverride != null ? this.shadowDistanceOverride : light.shadowDistance;
				let shadist = shadowDistance; // Distance to end of where we care
				if( dotProd > 0 ) {
					var diffuseAmt = dotProd; // Yep, that's how you calculate it.
					if( shadowsEnabled && shadist > 0 && diffuseAmt > 0 ) {
						var shadowLight = 1;
						stx = x + 0.5;
						sty = y + 0.5;
						stz = cellAvgDepths[i];
						stdx = light.traceVector.x;
						stdy = light.traceVector.y;
						stdz = light.traceVector.z;
						if( stdx == 0 && stdy == 0 ) {
							shadowLight = stdz < 0 ? 1 : 0;
						} else while( stz > minAvgDepth && stx > 0 && stx < width && sty > 0 && sty < height && shadist >= 0 ) {
							d = cellAvgDepths[(sty|0)*width + (stx|0)];
							if( stz > d ) {
								// Light let past for 'fuzz'
								var fuzzLight = Math.pow(light.shadowFuzz, stz - d);
								if( shadist === Infinity ) {
									shadowLight *= fuzzLight;
								} else {
									// Shadow influence; drops off with distance from shadow caster
									var shadinf = shadist / shadowDistance;
									shadowLight *= (1 - shadinf*(1-fuzzLight));
								}
								stz = d;
							}
							stx += stdx; sty += stdy; stz += stdz;
							shadist -= light.traceVectorLength;
						}
						diffuseAmt *= Math.max(shadowLight, light.minimumShadowLight);
					}
					r += diffuseAmt * light.color.r * mat.diffuse.r;
					g += diffuseAmt * light.color.g * mat.diffuse.g;
					b += diffuseAmt * light.color.b * mat.diffuse.b;
				}
			}
			cellColors[i*4+0] = r;
			cellColors[i*4+1] = g;
			cellColors[i*4+2] = b;
			cellColors[i*4+3] = a;
		}
		var s;
		for( s in this.shaders ) {
			this.shaders[s](this, region);
		}
		if( this.showUpdateRectangles ) {
			var fullb = 0.25;
			var halfb = 0.125;
			for( x=minX, i=width*minY+x; x<maxX; ++x, ++i ) {
				cellColors[i*4+0] += fullb;
				cellColors[i*4+1] += fullb;
				cellColors[i*4+2] += 0;
				cellColors[i*4+3] += fullb;
			}
			for( x=minX, i=width*(maxY-1)+x; x<maxX; ++x, ++i ) {
				cellColors[i*4+0] += fullb;
				cellColors[i*4+1] += halfb;
				cellColors[i*4+2] += 0;
				cellColors[i*4+3] += fullb;
			}
			for( y=minY, i=width*y+minX; y<maxY; ++y, i+=width ) {
				cellColors[i*4+0] += 0;
				cellColors[i*4+1] += fullb;
				cellColors[i*4+2] += fullb;
				cellColors[i*4+3] += fullb;
			}
			for( y=minY, i=width*y+(maxX-1); y<maxY; ++y, i+=width ) {
				cellColors[i*4+0] += 0;
				cellColors[i*4+1] += halfb;
				cellColors[i*4+2] += fullb;
				cellColors[i*4+3] += fullb;
			}
		}
	};

	updateCellColors():void {
		this.updateDepthDerivedData();
		processRectangleUpdates(this.updatingColorRectangles, this.calculateCellColors.bind(this));
	};

	copyToCanvas(region:Rectangle):void {
		const ss = this.shapeSheet;
		const width = ss.width, height = ss.height;
		region = Rectangle.intersection( region, ss.bounds );
		const {minX, minY, maxX, maxY} = region.assertIntegerBoundaries();
		
		const w = maxX-minX, h = maxY-minY;
		if( w <= 0 || h <= 0 ) return;
		
		if( this.canvas === null ) return;
		
		var ctx = this.canvas.getContext('2d');
		var encodeColorValue = function(i) {
			var c = Math.pow(i, 0.45);
			if( c > 1 ) return 255;
			return (c*255)|0;
		};
		var cellColors = this.cellColors;
		
		var imgData = ctx.getImageData(minX, minY, w, h);
		var imgDataData = imgData.data;
		
		var bi, idi, x, y;
		for( idi=0, y=minY; y<maxY; ++y ) {
			for( x=minX, bi=width*y+x; x<maxX; ++x, ++bi, ++idi ) {
				imgDataData[idi*4+0] = encodeColorValue(cellColors[bi*4+0]);
				imgDataData[idi*4+1] = encodeColorValue(cellColors[bi*4+1]);
				imgDataData[idi*4+2] = encodeColorValue(cellColors[bi*4+2]);
				imgDataData[idi*4+3] = cellColors[bi*4+3] * 255;
			}
		}
		if( this.showUpdateRectangles ) {
			imgDataData[0+0] = 255;
			imgDataData[0+2] = 255;
			imgDataData[(w*h*4)-4] = 255;
			imgDataData[(w*h*4)-3] = 255;
		}
		ctx.putImageData(imgData, minX, minY);
	};
	
	updateCanvas():void {
		this.canvasUpdateRequested = false;
		var i, r;
		this.updateCellColors();
		processRectangleUpdates(this.updatingCanvasRectangles, this.copyToCanvas.bind(this));
		++this.canvasUpdateCount;
	};

	requestCanvasUpdate():void {
		if( this.canvasUpdateRequested ) return;
		this.canvasUpdateRequested = true;
		window.requestAnimationFrame( (function() {
			this.updateCanvas();
		}).bind(this) );
	};
	
	////
	
	dataUpdated(region:Rectangle, shouldRecalculateNormals:boolean=true, shouldRecalculateColors:boolean=true):void {
		//console.log("Updated "+JSON.stringify(region));
		region = region.growToIntegerBoundaries();
		var ss = this.shapeSheet;
		
		if( shouldRecalculateNormals ) {
			this.updatingDepthRectangles = addToUpdateRectangleList(this.updatingDepthRectangles, region);
			// When the depth data gets updated, that will call
			// this function again with shouldRecalculateColors on the
			// appropriate (taking max shadow distance into account)
			// rectangles.
			// Therefore we can skip adding color update rectangles for now.
			return;
		}
		if( shouldRecalculateColors ) {
			this.updatingColorRectangles  = addToUpdateRectangleList(this.updatingColorRectangles , region);
			this.updatingCanvasRectangles = addToUpdateRectangleList(this.updatingCanvasRectangles, region);
		}
	};

	protected lightsUpdated():void {
		this.maxShadowDistance = 0;
		for( const l in this._lights ) {
			var light = this._lights[l];
			this.maxShadowDistance = Math.max(light.shadowDistance, this.maxShadowDistance);
		}
		if( this.shadowDistanceOverride != null ) {
			this.maxShadowDistance = this.shadowDistanceOverride;
		}
		this.dataUpdated(this.shapeSheet.bounds, false, true);
	};
	
	protected materialsUpdated():void {
		this.dataUpdated(this.shapeSheet.bounds, false, true);
	}

	//// Shader constructors

	public static makeFogShader(originDepth:number, fogColor:SurfaceColor):Shader {
		return function(ssr:ShapeSheetRenderer, region:Rectangle):void {
			const ss = ssr.shapeSheet;
			const {minX, maxX, minY, maxY} = region.assertIntegerBoundaries();
			const fogR = fogColor.r, fogG = fogColor.g, fogB = fogColor.b, fogA = fogColor.a;
			var width = ss.width;
			var cellAverageDepths = ssr.cellAverageDepths;
			var cellColors = ssr.cellColors;
			var x, y, i, d, r, g, b, a, oMix, fMix;
			var fogT = (1-fogA); // Fog transparency; how much of original color to keep at depth = 1 pixel
			for( y=minY; y < maxY; ++y ) for( x=minX, i=y*width+x; x < maxX; ++x, ++i ) {
				d = cellAverageDepths[i];
				if( d === Infinity ) {
					cellColors[i*4+0] = fogR;
					cellColors[i*4+1] = fogG;
					cellColors[i*4+2] = fogB;
					cellColors[i*4+3] = fogA == 0 ? 0 : 1;
					continue;
				}
				
				r = cellColors[i*4+0];
				g = cellColors[i*4+1];
				b = cellColors[i*4+2];
				a = cellColors[i*4+3];
				
				// Mix in fog *behind* this point (from the surface to infinity, which is always just fog color)
				r = r*a + fogR*(1-a);
				g = g*a + fogG*(1-a);
				b = b*a + fogB*(1-a);
				// Now add the fog ahead;
				// mix = how much of the original color to keep
				oMix = d < originDepth ? 1 : Math.pow(fogT, d - originDepth);
				fMix = 1-oMix;
				cellColors[i*4+0] = r*oMix + fogR*fMix;
				cellColors[i*4+1] = g*oMix + fogG*fMix;
				cellColors[i*4+2] = b*oMix + fogB*fMix;
				// At infinity, everything fades to fog color unless fog color = 0,
				// so that's the only case where there can be any transparency
				if( fogA > 0 ) cellColors[i*4+3] = 1;
			}
		};
	};
	
	public static shapeSheetToImage( ss:ShapeSheet, materials:Array<Material>, lights:KeyedList<DirectionalLight>  ):HTMLImageElement {
		const canv:HTMLCanvasElement = <HTMLCanvasElement>document.createElement('canvas');
		canv.width = ss.width;
		canv.height = ss.height;
		const rend:ShapeSheetRenderer = new ShapeSheetRenderer(ss, canv);
		rend.materials = materials;
		rend.lights = lights;
		rend.updateCanvas();
		const img:HTMLImageElement = <HTMLImageElement>document.createElement('img');
		img.src = canv.toDataURL();
		return img;
	}
};