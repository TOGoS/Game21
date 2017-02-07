import { thaw, deepFreeze } from './DeepFreezer';
import Rectangle from './Rectangle';
import ShapeSheet from './ShapeSheet';
import SurfaceColor from './SurfaceColor';
import LightColor from './LightColor';
import SurfaceMaterial, { SurfaceMaterialLayer } from './SurfaceMaterial';
import Vector3D from './Vector3D';
import { setVector, makeVector } from './vector3ds';
import { scaleVector } from './vector3dmath';
import KeyedList from './KeyedList';
import DirectionalLight from './DirectionalLight';
import {DEFAULT_LIGHTS} from './lights';
import {DEFAULT_MATERIAL_MAP} from './surfacematerials';

const LARGE_NUMBER = 1000;
const MIN_ROUGHNESS = 1/128;

function vectorXYLength(vect:Vector3D):number {
	return Math.sqrt(vect.x*vect.x + vect.y*vect.y);
};

// fit vector to [-1..1, -1..1, -inf..inf]
function normalizeVect3dToXYUnitSquare(vect:Vector3D):Vector3D {
	var len = Math.max(Math.abs(vect.x), Math.abs(vect.y));
	if( len == 0 ) return vect;
	return scaleVector(vect, 1/len);
};

function processRectangleUpdates(rectangleList:Array<Rectangle>, updater:(rect:Rectangle)=>void) {
	var i:any;
	var anythingUpdated = false;
	for( i in rectangleList ) {
		updater(rectangleList[i]);
		anythingUpdated = true;
	}
	rectangleList.splice(0);
	return anythingUpdated;
};

function maybeCombineRectangle(r0:Rectangle, r1:Rectangle):Rectangle|null {
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
	// Intrinsic properties
	/** Don't change!  Create a new renderer instead!
	 * I mean maybe you could if dimensions match, but why. */
	protected _shapeSheet:ShapeSheet;
	public canvas?:HTMLCanvasElement;
	protected _superSampling:number;
	
	// Configuration
	public shadowsEnabled:boolean = true;
	public shaders:Array<Shader> = [];
	public updateRectanglesVisible:boolean = false;
	protected _shadowDistanceOverride:number|undefined;
	protected _materials:Array<SurfaceMaterial>;
	protected _lights:KeyedList<DirectionalLight>;
	
	// Cached information
	public cellNormals:Float32Array;
	public cellColors:Float32Array;
	public minimumFrontDepth:number;
	protected maxShadowDistance:number = Infinity;
	
	// Update state
	protected canvasUpdateRequested:boolean = false;
	// TODO: these should probably be protected?
	public updatingDepthRectangles:Array<Rectangle> = [];
	public updatingColorRectangles:Array<Rectangle> = [];
	public updatingCanvasRectangles:Array<Rectangle> = [];
	
	// Debugging info
	public canvasUpdateCount:number = 0;
	
	constructor(shapeSheet:ShapeSheet, canvas:HTMLCanvasElement|undefined, superSampling:number=1) {
		this._shapeSheet = shapeSheet;
		this._superSampling = Math.round(superSampling);
		if( this._superSampling <= 0 ) {
			throw new Error("Supersampling must be an integer >= 0; was given: "+superSampling);
		}
		if( this._shapeSheet.width % superSampling != 0 ) {
			throw new Error("Shape sheet width must be a multiple of superSampling; "+this._shapeSheet.width+" % "+superSampling+" != 0");
		}
		if( this._shapeSheet.height % superSampling != 0 ) {
			throw new Error("Shape sheet height must be a multiple of superSampling; "+this._shapeSheet.height+" % "+superSampling+" != 0");
		}
		
		const cellCount = shapeSheet.area;
		this.cellNormals         = new Float32Array(cellCount*3); // normal vector X,Y,Z
		this.cellColors          = new Float32Array(cellCount*4); // r,g,b,a of each cell after shading
		
		this.canvas = canvas;
		
		// Need to set these last because setting them
		// may rely on other things being initialized
		
		this.materials = DEFAULT_MATERIAL_MAP;
		this.lights = DEFAULT_LIGHTS;
		
		this.minimumFrontDepth = Infinity;
		
		// Upon construction, unless the shapesheet happens to be completely blank,
		// we are out of sync with it, so mark the entire shapesheet as updated.
		this.dataUpdated(this.shapeSheet.bounds, true, true);
	};
	
	get shapeSheet():ShapeSheet { return this._shapeSheet; }
	
	get materials() {
		return this._materials;
	}
	set materials(materials:Array<SurfaceMaterial>) {
		this._materials = deepFreeze(materials);
		this.materialsUpdated();
	};
	
	get lights():KeyedList<DirectionalLight> { return this._lights; };
	set lights(lights:KeyedList<DirectionalLight>) {
		if( Object.is(lights, this._lights) ) return;
		
		this._lights = deepFreeze(lights);
		this.lightsUpdated();
	};
	
	get shadowDistanceOverride() { return this._shadowDistanceOverride; }
	set shadowDistanceOverride(sdo:number|undefined) {
		if( sdo != undefined && typeof(sdo) != 'number' ) {
			throw new Error("Non-number provided for shadowDistanceOverride: "+JSON.stringify(sdo));
		}
		if( this._shadowDistanceOverride === sdo ) return; // no-op!
		this._shadowDistanceOverride = sdo;
		this.lightsUpdated();
	}

	/**
	 * Slightly more efficient method for updating some lights
	 * (since unchanged ones don't need to be re-normalized) 
	 */
	putLights(updatedLights:KeyedList<DirectionalLight>):void {
		let lights = thaw(this._lights);
		for( let i in updatedLights ) {
			lights[i] = deepFreeze(updatedLights[i]);
		}
		this.lights = deepFreeze(lights, true);
		this.lightsUpdated();
	};
	
	getCellInfo(x:number, y?:number) {
		const ss = this.shapeSheet;
		const idx = y == null ? (x|0) : (y|0)*ss.width + (x|0);
		if( idx < 0 || idx >= ss.width*ss.height ) return null;
		return {
			materialIndex: ss.cellMaterialIndexes[idx],
			frontDepth: ss.cellDepths[idx],
			backDepth: ss.cellDepths[idx+ss.width*ss.height],
			dzDx: ss.cellSlopes[idx*2+0],
			dzDy: ss.cellSlopes[idx*2+1],
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
		
		let i:number, x:number, y:number;
		const cellDepths = ss.cellDepths; // It's front if we only use the first layer.
		const cellSlopes = ss.cellSlopes;
		let minimumFrontDepth = isFullRerender ? Infinity : this.minimumFrontDepth;
		
		const cellNormals = this.cellNormals;
		
		for( y=minY; y < maxY; ++y ) for( x=minX, i=ss.width*y+x; x < maxX; ++x, ++i ) {
			let depth = cellDepths[i];
			if( depth < minimumFrontDepth ) minimumFrontDepth = depth;
			
			let normalX = cellSlopes[i*2+0];
			let normalY = cellSlopes[i*2+1];
			let normalZ = -1;
			const normalLength = Math.sqrt(normalZ*normalZ + normalX*normalX + normalY*normalY);
			normalX /= normalLength;
			normalY /= normalLength;
			normalZ /= normalLength;
			
			cellNormals[i*3+0] = normalX;
			cellNormals[i*3+1] = normalY;
			cellNormals[i*3+2] = normalZ;
		}
		
		this.minimumFrontDepth = minimumFrontDepth;
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
		
		var i:number, l:string, x:number, y:number, d:number;
		var stx:number, sty:number, stz:number, stdx:number, stdy:number, stdz:number; // shadow tracing
		var cellColors = this.cellColors;
		var cellNormals = this.cellNormals;
		var materials = this.materials;
		var cellMaterialIndexes = ss.cellMaterialIndexes;
		var cellDepths = ss.cellDepths;
		var minAvgDepth = this.minimumFrontDepth;
		var lights = this.lights;
		var shadowsEnabled = this.shadowsEnabled;
		var light:DirectionalLight;
		const lightIntensities:KeyedList<number> = {}
		
		/*
		let anyNonInfinite = false;
		for( let i=cellDepths.length-1; i>=0; --i ) {
			if( cellDepths[i] == undefined ) {
				throw new Error("Undefined cell depth at index "+i);
			}
			if( cellDepths[i] != Infinity ) {
				anyNonInfinite = true;
			}
		}
		if( !anyNonInfinite ) {
			// FOR DEBUGGING
			console.log("Depth is infinite everywhere");
			return;
		}
		*/
		
		const shadowTraceSurfaceOffset = 0; // Set to some negative value to start tracing for shadows from just off the surface
		
		for( y=minY; y < maxY; ++y ) for( x=minX, i=width*y+x; x < maxX; ++x, ++i ) {
			var mat = materials[cellMaterialIndexes[i]];
			if( mat == null ) {
				throw new Error("No such material #" + cellMaterialIndexes[i]+" (at cell "+x+","+y+"; index "+i+")");
				//continue;
			}
			const matLayers = mat.layers;
			// Z being 'into' the picture (right-handed coordinate system!)
			
			var normalX = cellNormals[i*3+0],
				normalY = cellNormals[i*3+1],
				normalZ = cellNormals[i*3+2];
			
			let r = 0, g = 0, b = 0, a = 1;
			
			for( l in lights ) {
				lightIntensities[l] = 0;
				light = lights[l];
				const lightDir = light.direction;
				
				const shadowDistance = this._shadowDistanceOverride != null ? this._shadowDistanceOverride : light.shadowDistance;
				let shadist = shadowDistance; // Distance to end of where we care
				let lightLevel = 1;
				if( shadowsEnabled && shadist > 0 ) {
					var shadowLight = 1;
					const traceVec = light.traceVector;
					stx = x + 0.5;
					sty = y + 0.5;
					stz = cellDepths[i] + shadowTraceSurfaceOffset;
					stdx = traceVec.x;
					stdy = traceVec.y;
					stdz = traceVec.z;
					if( stdx == 0 && stdy == 0 ) {
						shadowLight = stdz < 0 ? 1 : 0;
					} else while( stz > minAvgDepth && stx > 0 && stx < width && sty > 0 && sty < height && shadist >= 0 ) {
						// In theory mode 1 might result in slightly higher-quality shadows,
						// but I can't tell the difference, so leaving at 0.
						const sampleDepthFindingMethod = 0;
						if( sampleDepthFindingMethod == 0 ) {
							d = cellDepths[(sty|0)*width + (stx|0)];
						} else {
							const sampSubX = stx - (stx|0);
							const sampSubY = sty - (sty|0);
							const cellIdx = (sty|0)*width + (stx|0);
							d = cellDepths[cellIdx];
						}
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
							stz = d + shadowTraceSurfaceOffset;
						}
						stx += stdx; sty += stdy; stz += stdz;
						shadist -= light.traceVectorLength;
					}
					lightLevel *= Math.max(shadowLight, light.minimumShadowLight);
				}
				lightIntensities[l] = lightLevel;
			}
			
			for( let i=matLayers.length-1, layerContrib = 1; layerContrib > 0 && i>=0; --i ) {
				const layer:SurfaceMaterialLayer = matLayers[i];
				const sss = Math.max(0, layer.ruffness - 1.0);
				const layerDiffuse = layer.diffuse;
				// Higher ruffness spreads out the light more.
				// Low ruffness leads to a very bright spot concentrated toward the light.
				//           lightCameraDotProd ->
				// ruffness       0  0.5  1.0
				//  |    0.0       0  0.0  1.0
				//  v    0.5       0  0.1  0.8
				//       1.0       0  0.4  0.5
				const fixFactor = 1.0 / (1 + sss);
				const ruffness = Math.max(MIN_ROUGHNESS, Math.min(1.0, layer.ruffness));
				
				// Not very physically accurate IoR-based reflection
				const refractiness = Math.min(1, layer.indexOfRefraction - 1.0);
				// @normalZ = 0, extraOpac = 1;  @normalZ = -1, extraOpac = 0
				const extraOpac = (1 + normalZ) * refractiness;
				const layerOpac = layerDiffuse.a + (1.0 - layerDiffuse.a) * extraOpac;
				
				const layerGlow = layer.glow;
				r += layerContrib * layerGlow.r;
				g += layerContrib * layerGlow.g;
				b += layerContrib * layerGlow.b;
				
				for( let l in lights ) {
					const lightDir = lights[l].direction;
					const lightColor = lights[l].color;
					const lightLevel = lightIntensities[l];
			
					var lightCameraDotProd = -(normalX*lightDir.x + normalY*lightDir.y + normalZ*lightDir.z);
					const minDotProd = -1; // 0 if no subsurface scattering, 1 if there is.  Maybe can cache on material.
					if( lightCameraDotProd > minDotProd ) {
						const adjustedDotProd = lightCameraDotProd + sss*(1-lightCameraDotProd)/2;
						if( adjustedDotProd < 0 ) continue;
						const diffuseAmt = fixFactor * Math.pow(adjustedDotProd, 1/ruffness) / Math.pow(ruffness, 0.5);
						const layerLightAmt = lightLevel * diffuseAmt * layerContrib * layerOpac;
						
						r += layerLightAmt * lightColor.r * layerDiffuse.r;
						g += layerLightAmt * lightColor.g * layerDiffuse.g;
						b += layerLightAmt * lightColor.b * layerDiffuse.b;
					}
				}
				
				// Next layer can only contribute through the holes in this one
				layerContrib *= (1-layerOpac);
			}
			
			cellColors[i*4+0] = r;
			cellColors[i*4+1] = g;
			cellColors[i*4+2] = b;
			cellColors[i*4+3] = a;
		}
		
		var s:any;
		for( let s in this.shaders ) {
			this.shaders[s](this, region);
		}
		if( this.updateRectanglesVisible ) {
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
	
	static toUint8Rgba(
		sourceColors:Float32Array, sourceOffset:number, sourceSpan:number,
		destRgba:Uint8ClampedArray, destOffset:number, destSpan:number,
		destCols:number, destRows:number, superSampling:number
	):void {
		const encodeColorValue = function(i:number):number {
			var c = Math.pow(i, 0.45);
			if( c > 1 ) return 255;
			return (c*255)|0;
		};
		
		const ssArea = superSampling*superSampling;
		
		for( let y = 0; y < destRows; ++y ) {
			const destRowOffset = destOffset + (y*destSpan); 
			for( let x = 0; x < destCols; ++x ) {
				const destIdx:number = destRowOffset + (x*4);
				
				let r = 0, g = 0, b = 0, a = 0;
				
				for( let ssy = 0; ssy < superSampling; ++ssy ) {
					for( let ssx = 0; ssx < superSampling; ++ssx ) {
						const sourceIdx = sourceOffset + ((y*superSampling)+ssy)*sourceSpan + ((x*superSampling)+ssx)*4;
						const alpha = sourceColors[sourceIdx+3];
						a += alpha;
						// Need to multiply by alpha to weight colors properly; will divide by average alpha later.
						r += sourceColors[sourceIdx+0] * alpha;
						g += sourceColors[sourceIdx+1] * alpha;
						b += sourceColors[sourceIdx+2] * alpha;
					}
				}
				
				const avgA = a / ssArea;
				destRgba[destIdx+3] = avgA * 255;
				const mult = a == 0 ? 0 : 1 / avgA / ssArea; // Need to un-pre-multiply alpha
				destRgba[destIdx+0] = encodeColorValue(r * mult);
				destRgba[destIdx+1] = encodeColorValue(g * mult);
				destRgba[destIdx+2] = encodeColorValue(b * mult);
			}
		}
	}
	
	public toUint8Rgba():Uint8ClampedArray {
		const ss = this._superSampling;
		const ssArea = ss*ss;
		const sheetWidth = this._shapeSheet.width;
		const sheetHeight = this._shapeSheet.height;
		const imgWidth = sheetWidth/ss, imgHeight=sheetHeight/ss;
		const arr = new Uint8ClampedArray(4*sheetWidth*sheetHeight/ssArea);
		ShapeSheetRenderer.toUint8Rgba(
			this.cellColors, 0, 4*sheetWidth,
			arr, 0, 4*imgWidth, imgWidth, imgHeight, ss
		);
		return arr;
	}
	
	copyToCanvas(region:Rectangle):void {
		const ss = this.shapeSheet;
		const width = ss.width, height = ss.height;
		region = Rectangle.intersection( region, ss.bounds );
		const sup = this._superSampling;
		let {minX:_minX, minY:_minY, maxX:_maxX, maxY:_maxY} = region.assertIntegerBoundaries();
		let destMinX = Math.floor(_minX/sup);
		let destMinY = Math.floor(_minY/sup);
		let destMaxX = Math.ceil( _maxX/sup);
		let destMaxY = Math.ceil( _maxY/sup);
		// Constructor would not have allowed supersampling such that
		// it would not align with boundaries.
		// Otherwise we'd need to check or adjust here.
		const destW = destMaxX-destMinX;
		const destH = destMaxY-destMinY;
		if( destW <= 0 || destH <= 0 ) return;
		
		const minX = destMinX*sup, minY = destMinY*sup, maxX = destMaxX*sup, maxY = destMaxY*sup;
		
		const w = maxX-minX, h = maxY-minY;
		
		if( this.canvas == undefined ) return;
		
		var ctx = this.canvas.getContext('2d');
		if( !ctx ) throw new Error("No '2d' context from my canvas!");
		var cellColors = this.cellColors;
		
		var imgData = ctx.getImageData(destMinX, destMinY, destW, destH);
		if( !imgData ) throw new Error("ctx.getImageData returned null");
		var imgDataData = imgData.data;
		
		ShapeSheetRenderer.toUint8Rgba(
			cellColors, 4*(minY*width+minX), 4*width,
			imgDataData, 0, 4*destW,
			destMaxX-destMinX, destMaxY-destMinY, sup
		);
		
		if( this.updateRectanglesVisible ) {
			imgDataData[0+0] = 255;
			imgDataData[0+2] = 255;
			imgDataData[(w*h*4)-4] = 255;
			imgDataData[(w*h*4)-3] = 255;
		}
		ctx.putImageData(imgData, destMinX, destMinY);
	};
	
	/**
	 * Process any updates and copy to canvas immediately.
	 * For UI you probably want requestCanvasUpdate() instead,
	 * unless you're already inside an animation frame call.
	 */
	updateCanvas():void {
		this.canvasUpdateRequested = false;
		this.updateCellColors();
		processRectangleUpdates(this.updatingCanvasRectangles, this.copyToCanvas.bind(this));
		++this.canvasUpdateCount;
	};
	
	/**
	 * Request an update to be done in the next animation frame
	 * if it hasn't been requested already.
	 */
	requestCanvasUpdate():void {
		if( this.canvasUpdateRequested ) return;
		this.canvasUpdateRequested = true;
		window.requestAnimationFrame( () => {
			this.updateCanvas();
		} );
	};
	
	////
	
	dataUpdated(region?:Rectangle, shouldRecalculateNormals:boolean=true, shouldRecalculateColors:boolean=true):void {
		if( !region ) region = this.shapeSheet.bounds;
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
		// Recalculate max shadow distance
		if( this._shadowDistanceOverride != null ) {
			this.maxShadowDistance = this._shadowDistanceOverride;
		} else {
			this.maxShadowDistance = 0;
			for( const l in this._lights ) {
				var light = this._lights[l];
				this.maxShadowDistance = Math.max(light.shadowDistance, this.maxShadowDistance);
			}
		}
		
		// And invalidate everything
		this.dataUpdated(this.shapeSheet.bounds, false, true);
	}
	
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
			var cellDepths = ss.cellDepths;
			var cellColors = ssr.cellColors;
			var x:number, y:number, i:number, d:number, r:number, g:number, b:number, a:number, oMix:number, fMix:number;
			var fogT = (1-fogA); // Fog transparency; how much of original color to keep at depth = 1 pixel
			for( y=minY; y < maxY; ++y ) for( x=minX, i=y*width+x; x < maxX; ++x, ++i ) {
				d = cellDepths[i];
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
	
	public static shapeSheetToImage( ss:ShapeSheet, materials:Array<SurfaceMaterial>, lights:KeyedList<DirectionalLight>, superSampling:number=1 ):HTMLImageElement {
		const canv:HTMLCanvasElement = <HTMLCanvasElement>document.createElement('canvas');
		canv.width = ss.width / superSampling;
		canv.height = ss.height / superSampling;
		const rend:ShapeSheetRenderer = new ShapeSheetRenderer(ss, canv, superSampling);
		rend.materials = materials;
		rend.lights = lights;
		rend.updateCanvas();
		const img:HTMLImageElement = <HTMLImageElement>document.createElement('img');
		img.src = canv.toDataURL();
		return img;
	}
};
