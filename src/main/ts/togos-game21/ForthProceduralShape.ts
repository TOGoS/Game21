import { thaw, deepFreeze } from './DeepFreezer';
import KeyedList from './KeyedList';
import Rectangle from './Rectangle';
import Vector3D from './Vector3D';
import { makeVector, setVector, ZERO_VECTOR } from './vector3ds';
import TransformationMatrix3D from './TransformationMatrix3D';
import { AnimationCurveName } from './AnimationCurve';
import ShapeSheetUtil from './ShapeSheetUtil';
import ProceduralShape, { ProceduralShapeParameters } from './ProceduralShape';
import Token, { TokenType } from './lang/Token';
import { isResolved } from './promises';
import {
	Program, RuntimeContext, CompilationContext, Word, RuntimeWord, CompilationWord, WordType,
	atText, compileSource, runContext
} from './forth/rs1';
import SourceLocation from './lang/SourceLocation';
import {
	standardWords, makeWordGetter, mergeDicts, parseNumberWord
} from './forth/rs1words';

export const FORTH_PROCEDURAL_SCRIPT_MAGIC_LINE = '#G21-FPS-1.0';

interface SavableContext {
	contextValues : KeyedList<any>;
	transform : TransformationMatrix3D;
	polygonPoints : number[];
}

interface ShapeGeneratorContext extends RuntimeContext, SavableContext {
	shapeSheetUtil : ShapeSheetUtil;
	contextStack : SavableContext[];
	polygonPoints : number[];
}

const tempVec = makeVector();
const tempXf = new TransformationMatrix3D;

interface ContextVariableRef {
	variableName : string;
}

class GetContextValueWord implements RuntimeWord {
	wordType = WordType.OTHER_RUNTIME;
	constructor( public name:string ) { }
	forthRun( ctx:RuntimeContext ):void {
		--ctx.fuel;
		ctx.dataStack.push( (<ShapeGeneratorContext>ctx).contextValues[this.name] );
	}
}

class GetContextVariableWord implements RuntimeWord {
	wordType = WordType.OTHER_RUNTIME;
	constructor( public name:string, public variableRef:ContextVariableRef ) { }
	forthRun( ctx:RuntimeContext ):void {
		--ctx.fuel;
		ctx.dataStack.push( this.variableRef );
	}
}

const fetchValueWord : RuntimeWord = {
	wordType: WordType.OTHER_RUNTIME,
	name: "@",
	forthRun( ctx:RuntimeContext ):void {
		--ctx.fuel;
		const ref = ctx.dataStack.pop();
		if( ref == null || !ref.variableName ) {
			throw new Error(ref+" is not a context varable!");
		}
		ctx.dataStack.push( (<ShapeGeneratorContext>ctx).contextValues[ref.variableName] );
	}
}

const storeValueWord : RuntimeWord = {
	wordType: WordType.OTHER_RUNTIME,
	name: "!",
	forthRun(ctx:RuntimeContext ):void {
		--ctx.fuel;
		const ref = ctx.dataStack.pop();
		if( ref == null || !ref.variableName ) {
			throw new Error(ref+" is not a context varable!");
		}
		const val = ctx.dataStack.pop();
		const sgctx = <ShapeGeneratorContext>ctx;
		if( Object.isFrozen(sgctx.contextValues) ) sgctx.contextValues = thaw(sgctx.contextValues);
		sgctx.contextValues[ref.variableName] = val;
	}
}

function declareContextVariable( ctx:CompilationContext, name:string ):void {
	ctx.dictionary[name] = new GetContextValueWord(name);
	ctx.dictionary['$'+name] = new GetContextVariableWord(name, {variableName:name});
}

function applyTransform( sgctx:ShapeGeneratorContext, xf:TransformationMatrix3D ) {
	if( Object.isFrozen(sgctx.transform) ) sgctx.transform = sgctx.transform.clone();
	TransformationMatrix3D.multiply(sgctx.transform, xf, sgctx.transform);
}

function addPolygonPoint( points:number[], xf:TransformationMatrix3D ):void {
	xf.multiplyVector(ZERO_VECTOR, tempVec);
	points.push(tempVec.x, tempVec.y, tempVec.z);
}

function fixMaterialParameters( sgctx:ShapeGeneratorContext ):void {
	sgctx.shapeSheetUtil.plottedMaterialIndexFunction = () => +sgctx.contextValues["material-index"];
}

const customWords : KeyedList<Word> = {
	"open-polygon": <RuntimeWord> {
		name: "open-polygon",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: <RuntimeWord> (ctx:RuntimeContext):void => {
			const sgctx:ShapeGeneratorContext = (<ShapeGeneratorContext>ctx);

			if( Object.isFrozen(sgctx.polygonPoints) ) sgctx.polygonPoints = [];
			else sgctx.polygonPoints.length = 0;
			
			addPolygonPoint(sgctx.polygonPoints, sgctx.transform);
		}
	},
	"polygon-point": <RuntimeWord> {
		name: "polygon-point",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: <RuntimeWord> (ctx:RuntimeContext):void => {
			const sgctx:ShapeGeneratorContext = (<ShapeGeneratorContext>ctx);

			if( Object.isFrozen(sgctx.polygonPoints) ) sgctx.polygonPoints = thaw(sgctx.polygonPoints);
			
			addPolygonPoint(sgctx.polygonPoints, sgctx.transform);
		}
	},
	"fill-polygon": <RuntimeWord> {
		name: "fill-polygon",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: <RuntimeWord> (ctx:RuntimeContext):void => {
			const sgctx:ShapeGeneratorContext = (<ShapeGeneratorContext>ctx);

			if( Object.isFrozen(sgctx.polygonPoints) ) sgctx.polygonPoints = thaw(sgctx.polygonPoints);
			
			addPolygonPoint(sgctx.polygonPoints, sgctx.transform);
			fixMaterialParameters(sgctx);
			sgctx.shapeSheetUtil.plotConvexPolygon(sgctx.polygonPoints, true);
		}
	},
	"fill-clockwise-polygon": <RuntimeWord> {
		"name": "fill-clockwise-polygon",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: <RuntimeWord> (ctx:RuntimeContext):void => {
			const sgctx:ShapeGeneratorContext = (<ShapeGeneratorContext>ctx);

			if( Object.isFrozen(sgctx.polygonPoints) ) sgctx.polygonPoints = thaw(sgctx.polygonPoints);
			
			addPolygonPoint(sgctx.polygonPoints, sgctx.transform);
			fixMaterialParameters(sgctx);
			sgctx.shapeSheetUtil.plotConvexPolygon(sgctx.polygonPoints, false);
		}
	},
	"plot-sphere": <RuntimeWord> {
		name: "plot-sphere",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: <RuntimeWord> (ctx:RuntimeContext):void => {
			const sgctx:ShapeGeneratorContext = (<ShapeGeneratorContext>ctx);
			const rad = +ctx.dataStack.pop();
			setVector(tempVec,0,0,0);
			fixMaterialParameters(sgctx);
			sgctx.transform.multiplyVector( tempVec, tempVec );
			(<ShapeGeneratorContext>ctx).shapeSheetUtil.plotSphere( tempVec.x, tempVec.y, tempVec.z, sgctx.transform.scale * rad );
		}
	},
	"move": <RuntimeWord> {
		name: "move",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: <RuntimeWord> (ctx:RuntimeContext):void => {
			const sgctx:ShapeGeneratorContext = (<ShapeGeneratorContext>ctx);
			const z = sgctx.dataStack.pop();
			const y = sgctx.dataStack.pop();
			const x = sgctx.dataStack.pop();
			applyTransform(sgctx, TransformationMatrix3D.translationXYZ(x,y,z, tempXf));
		}
	},
	"scale": <RuntimeWord> {
		name: "scale",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: <RuntimeWord> (ctx:RuntimeContext):void => {
			const sgctx:ShapeGeneratorContext = (<ShapeGeneratorContext>ctx);
			const scale = sgctx.dataStack.pop();
			applyTransform(sgctx, TransformationMatrix3D.scale(scale, scale, scale, tempXf));
		}
	},
	"deg2rad": <RuntimeWord> {
		"name": "deg2rad",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: <RuntimeWord> (ctx:RuntimeContext):void => {
			ctx.dataStack.push( ctx.dataStack.pop() * Math.PI / 180 );
		},
	},
	"aarotate": <RuntimeWord> {
		"name": "aarotate",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: <RuntimeWord> (ctx:RuntimeContext):void => {
			const sgctx:ShapeGeneratorContext = (<ShapeGeneratorContext>ctx);
			const ang = sgctx.dataStack.pop();
			const z = sgctx.dataStack.pop();
			const y = sgctx.dataStack.pop();
			const x = sgctx.dataStack.pop();
			const l = Math.sqrt(x*x+y*y+z*z);
			applyTransform(sgctx, TransformationMatrix3D.fromXYZAxisAngle(x/l, y/l, z/l, ang, tempXf));
		}
	},
	"save-context": <RuntimeWord> {
		"name": "save-context",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: <RuntimeWord> (ctx:RuntimeContext):void => {
			const sgctx:ShapeGeneratorContext = (<ShapeGeneratorContext>ctx);
			sgctx.contextStack.push( {
				contextValues: deepFreeze(sgctx.contextValues, true),
				transform: deepFreeze(sgctx.transform, true),
				polygonPoints: deepFreeze(sgctx.polygonPoints, true),
			} );
		}
	},
	"restore-context": <RuntimeWord> {
		"name": "restore-context",
		wordType: WordType.OTHER_RUNTIME,
		forthRun: <RuntimeWord> (ctx:RuntimeContext):void => {
			const sgctx:ShapeGeneratorContext = (<ShapeGeneratorContext>ctx);
			const saved = sgctx.contextStack.pop();
			if( saved == null ) {
				console.error("Saved context stack empty; can't restore-context");
				return;
			}
			sgctx.contextValues = saved.contextValues,
			sgctx.transform = saved.transform;
		}
	},
	"context-variable:": <CompilationWord> {
		name: "context-variable:",
		wordType: WordType.OTHER_COMPILETIME,
		forthCompile: <CompilationWord> (ctx:CompilationContext):void => {
			ctx.onToken = (nameT:Token) => {
				switch( nameT.type ) {
				case TokenType.BAREWORD: case TokenType.SINGLE_QUOTED:
					ctx.onToken = null;
					if( nameT.text.charAt(0) != '$' ) {
						throw new Error("Symbol after 'context-variable:' must start with \"$\""+atText(nameT.sourceLocation));
					}
					declareContextVariable(ctx, nameT.text.substr(1));
					return;
				case TokenType.END_OF_FILE:
					throw new Error("Encountered end of file when expecting context variable name "+atText(nameT.sourceLocation));
				case TokenType.DOUBLE_QUOTED:
					throw new Error("Encountered quoted string when expecting context variable name "+atText(nameT.sourceLocation));
				default:
					throw new Error("Unexpected token type "+nameT.type+" when expecting context variable name "+atText(nameT.sourceLocation));
				}
			}
		}
	},
	"!": storeValueWord,
	"@": fetchValueWord,
}

export interface ScriptProceduralShapeData {
	classRef : "http://ns.nuke24.net/Game21/ScriptProceduralShape";
	languageName : "G21-FPS-1.0";
	maxRadius? : number;
	programSource : string;
	
	animationCurveName : AnimationCurveName;
	animationLength : number;
	discreteAnimationStepCount : number;
}

export interface ForthProceduralShapeData extends ScriptProceduralShapeData {
	program : Program;
}

const ANONYMOUS_SOURCELOC = {
	filename:'anynymous source', lineNumber:1, columnNumber:1
};

function parseNumberOrFraction( text:string ) : number|undefined {
	if( /^[+-]?\d+(\.\d+)?$/.test(text) ) {
		return +text;
	}
	let m:string[]|null;
	if( (m = /^([+-]?\d+)\/(\d+)$/.exec(text)) ) {
		return +m[1]/+m[2];
	}
	return undefined;
}

export class ForthProceduralShapeCompiler {
	public compileProgram(script:string, sourceLocation:SourceLocation=ANONYMOUS_SOURCELOC) : Thenable<CompilationContext> {
		const ctx : CompilationContext = {
			sourceLocation: sourceLocation,
			dictionary: mergeDicts(standardWords, customWords),
			fallbackWordGetter: makeWordGetter( parseNumberWord ),
			onToken: null,
			program: [],
			fixups: {},
			compilingMain: true,
		};
		return compileSource( script, ctx, sourceLocation );
	}
	
	public compileToShape(script:string, sourceLocation:SourceLocation=ANONYMOUS_SOURCELOC):Thenable<ForthProceduralShape> {
		const headerValues:KeyedList<string> = {};
		readHeaders: {
			const lines = script.split("\n");
			for( let l in lines ) {
				const line = lines[l];
				let m:RegExpExecArray|null;
				if( (m = /^#([^\s:]+):\s+(.*)/.exec(line) ) ) {
					headerValues[m[1]] = m[2];
				}
				if( line == '' || line[0] != '#' ) break readHeaders;
			}
		}
		
		let animationLength:number = parseNumberOrFraction(headerValues['animation-length']) || 0;
		const headerAnimationCurveName:string|AnimationCurveName|undefined = headerValues['animation-curve'];
		let animationCurveName:AnimationCurveName;
		if( animationLength == 0 ) {
			animationCurveName = 'none';
		} else switch( headerAnimationCurveName ) {
		case 'none': case 'once': case 'loop': case 'reverse':
			animationCurveName = headerAnimationCurveName;
			break;
		default:
			animationCurveName = 'loop';
		}
		
		let discreteAnimationStepCount:number =
			animationLength == 0 ? 1 : parseNumberOrFraction(headerValues['animation-step-count'])|0;
		
		return this.compileProgram(script, sourceLocation).then( (ctx) => {
			return new ForthProceduralShape({
				classRef: "http://ns.nuke24.net/Game21/ScriptProceduralShape",
				languageName: "G21-FPS-1.0", // TODO: parse from headers
				maxRadius: 8, // TODO: parse from headers
				programSource: script,
				program: ctx.program,
				
				animationCurveName,
				animationLength,
				discreteAnimationStepCount,
			});
		});
	}
}

export function extractHeaderValues(programSource:string):KeyedList<String> {
	const headerValues:KeyedList<String> = {};
	fixScriptText(programSource, headerValues); // Ha ha ha; well, it should owrk.
	return headerValues;
}

export function fixScriptText(programSource:string, headerValues:KeyedList<String>={}):string {
	let lines:string[] = programSource.split("\n");

	let headerLines:string[] = [];
	let scriptLines:string[] = [];

	let state = 0; // 0 = processing headers, 1 = done processing headers
	for( let l = 0; l < lines.length; ++l ) {
		const line = lines[l];
		let match : string[] | null;
		if( state == 0 && (match = line.match(/^#\S.*/)) ) {
			let tline = line.trim();
			if( tline == FORTH_PROCEDURAL_SCRIPT_MAGIC_LINE ) {
				if( l == 0 ) headerLines.push(tline);
				// Otherwise ignore it
			} else if( (match = tline.match(/^#(\S+):\s*(\S.*)$/)) ) {
				headerValues[match[1]] = match[2];
				headerLines.push("#"+match[1]+": "+match[2]);
			} else {
				headerLines.push(tline);
			}
		} else {
			state = 1;
			scriptLines.push(line);
		}
	}

	if( headerLines.length == 0 || headerLines[0] !== FORTH_PROCEDURAL_SCRIPT_MAGIC_LINE ) {
		headerLines.unshift(FORTH_PROCEDURAL_SCRIPT_MAGIC_LINE);
	}

	let firstNEScriptLine = Infinity;
	let lastNEScriptLine = -Infinity;
	// Trim excess script lines
	for( let l=0; l<scriptLines.length; ++l ) {
		if( !scriptLines[l].match(/^\s*$/) ) {
			if( l < firstNEScriptLine ) firstNEScriptLine = l;
			lastNEScriptLine = l;
		}
	}

	let fixedText = "";
	for( let h in headerLines ) {
		fixedText += headerLines[h]+"\n";
	}
	if( firstNEScriptLine < Infinity ) {
		fixedText += "\n";
		for( let l = firstNEScriptLine; l <= lastNEScriptLine; ++l ) {
			fixedText += scriptLines[l]+"\n";
		}
	}

	return fixedText;
}

export default class ForthProceduralShape implements ProceduralShape, ForthProceduralShapeData {
	public classRef : "http://ns.nuke24.net/Game21/ScriptProceduralShape";
	public languageName : "G21-FPS-1.0";
	public maxRadius? : number;
	public programSource : string;
	public program : Program;
	public animationCurveName : AnimationCurveName;
	public animationLength : number;
	public discreteAnimationStepCount : number;
	
	public constructor( public data:ForthProceduralShapeData ) {
		this.classRef = "http://ns.nuke24.net/Game21/ScriptProceduralShape";
		this.languageName = data.languageName;
		this.maxRadius = data.maxRadius;
		this.programSource = data.programSource;
		this.program = data.program;
		this.animationLength = data.animationLength;
		this.animationCurveName = data.animationCurveName;
		this.discreteAnimationStepCount = data.discreteAnimationStepCount;
	}
	
	public estimateOuterBounds( params:ProceduralShapeParameters, xf:TransformationMatrix3D ):Rectangle {
		const s = xf.scale;
		const xfRad = s*(this.maxRadius == null ? 16 : 16);
		return new Rectangle( -xfRad, -xfRad, +xfRad, +xfRad );
	}

	public draw( ssu:ShapeSheetUtil, params:ProceduralShapeParameters, xf:TransformationMatrix3D ):void {
		const ctx : ShapeGeneratorContext = {
			program: this.program,
			dataStack: [],
			returnStack: [],
			ip: 0,
			fuel: 100000,
			shapeSheetUtil: ssu,
			contextValues: deepFreeze({
				't': params.t,
				'entity-state': params.entityState,
				'material-index': 4,
			}),
			transform: xf,
			contextStack: [],
			polygonPoints: [],
		}
		
		ssu.plottedMaterialIndexFunction = (x,y,z) => 8;
		const p = runContext( ctx );
		if( !isResolved(p) ) throw new Error("Procedural shape program didn't finish immediately");
	}
}
