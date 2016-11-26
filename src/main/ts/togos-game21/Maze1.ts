import { sha1Urn, utf8Encode, utf8Decode } from '../tshash/index';
import Datastore from './Datastore';
import HTTPHashDatastore from './HTTPHashDatastore';
import MemoryDatastore from './MemoryDatastore';
import CachingDatastore from './CachingDatastore';
import BrowserStorageDatastore from './BrowserStorageDatastore';
import MultiDatastore from './MultiDatastore';
import { finalmente } from './promises';

import { deepFreeze, thaw, deepThaw, isDeepFrozen } from './DeepFreezer';
import GameDataManager from './GameDataManager';
import { fetchObject, storeObject, fastStoreObject, encodeObject } from './JSONObjectDatastore';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import KeyedList, { elementCount } from './KeyedList';
import Vector3D from './Vector3D';
import { makeVector, setVector, vectorToString, parseVector, ZERO_VECTOR } from './vector3ds';
import {
	accumulateVector, addVector, subtractVector, scaleVector, normalizeVector,
	vectorLength, vectorIsZero, dotProduct, roundVectorToGrid
} from './vector3dmath';
import AABB from './AABB';
import {
	makeAabb, aabbWidth, aabbHeight, aabbDepth,
	aabbAverageX, aabbAverageY, aabbAverageZ,
	aabbContainsVector, aabbIntersectsWithOffset, offsetAabbContainsVector,
	ZERO_AABB
} from './aabbs';
import Quaternion from './Quaternion';
import TransformationMatrix3D from './TransformationMatrix3D';
import SceneShader, { ShadeRaster, VISIBILITY_VOID, VISIBILITY_NONE, VISIBILITY_MIN } from './SceneShader';
import { uuidUrn, newType4Uuid } from '../tshash/uuids';
import {
	makeTileTreeRef, makeTileEntityPaletteRef, eachSubEntity, eachSubEntityIntersectingBb, connectRooms,
	getEntitySubsystem, setEntitySubsystem, getEntitySubsystems
} from './worldutil';
import {
	EntityPath,
	SimulationAction,
	ROOMID_SIMULATOR,
	ROOMID_FINDENTITY,
	ROOMID_EXTERNAL,
} from './simulationmessaging';
import EntitySubsystem, {
	ESSKEY_PROXIMALEVENTDETECTOR,
	ESSKEY_VISION,
	ESSCR_VISION,
} from './EntitySubsystem'
import ViewScene from './Maze1ViewScene';
import * as esp from './internalsystemprogram';
import * as dat from './maze1demodata';
import * as http from './http';
import {
	Room,
	RoomEntity,
	RoomLocation,
	RoomVisualEntity,
	Entity,
	EntityClass,
	TileTree,
	TileEntity,
	StructureType,
	TileEntityPalette,
} from './world';
import EntitySystemBusMessage from './EntitySystemBusMessage';
import newUuidRef from './newUuidRef';

import { SimulationUpdateContext, ExternalDevice } from './maze1simulationstuff'; 
import SimulationUpdate from './Maze1SimulationUpdate';
import MazeSimulator from './Maze1Simulator';
import SimulationState, { HardSimulationState } from './Maze1SimulationState';

import Tokenizer from './lang/Tokenizer';
import Token, { TokenType } from './lang/Token';

import Logger from './Logger';
import MultiLogger from './MultiLogger';
import DOMLogger from './ui/DOMLogger';
import TilePaletteUI, { PaletteItem } from './ui/TilePalette';
import {
	StorageCompartmentContentUI
} from './ui/inventory';
import SoundPlayer from './ui/SoundPlayer';
import ImageSlice from './ImageSlice';
import { EMPTY_IMAGE_SLICE, imageFromUrl } from './images';

import {
	ITEMCLASS_BLUEKEY,
	ITEMCLASS_YELLOWKEY,
	ITEMCLASS_REDKEY,
} from './graphmaze';
import GraphMazeGenerator from './graphmaze/GraphMazeGenerator2';
import GraphWorldifier, { mazeToWorld } from './graphmaze/GraphWorldifier';

import SimulationMessage, {
	SimpleEventOccurred,
	TextHeard,
	ProximalSimulationMessage,
} from './SimulationMessage';

// KeyEvent isn't always available, boo.
const KEY_CTRL = 17;
const KEY_ESC = 27;
const KEY_UP = 38;
const KEY_DOWN = 40;
const KEY_ENTER = 13;
const KEY_TAB = 9;
const KEY_SLASH = 191;
const KEY_BACKTICK = 192;
const KEY_0 = 48;
const KEY_9 = 57;

function base64Encode(data:Uint8Array):string {
	// btoa is kinda goofy.
	const strs = new Array(data.length);
	for( let i=data.length-1; i>=0; --i ) strs[i] = String.fromCharCode(data[i]);
	return btoa(strs.join(""));
}

function hexVal(charCode:number):number {
	switch( charCode ) {
	case 0x30: return 0;
	case 0x31: return 1;
	case 0x32: return 2;
	case 0x33: return 3;
	case 0x34: return 4;
	case 0x35: return 5;
	case 0x36: return 6;
	case 0x37: return 7;
	case 0x38: return 8;
	case 0x39: return 9;
	case 0x41: case 0x61: return 10;
	case 0x42: case 0x62: return 11;
	case 0x43: case 0x63: return 12;
	case 0x44: case 0x64: return 13;
	case 0x45: case 0x65: return 14;
	case 0x46: case 0x66: return 15;
	default: throw new Error("Invalid hex digit: "+String.fromCharCode(charCode));
	}
}

function hexDecodeBits( enc:string ):Array<number> {
	const arr = new Array<number>(enc.length * 4);
	for( let i=0; i<enc.length; ++i ) {
		const n = hexVal(enc.charCodeAt(i));
		arr[i*4+0] = (n >> 3) & 1;
		arr[i*4+1] = (n >> 2) & 1;
		arr[i*4+2] = (n >> 1) & 1;
		arr[i*4+3] = (n >> 0) & 1;
	}
	return arr;
}

function numberToFillStyle( col:number ):string {
	return 'rgba('+
		((col>>24)&0xFF)+','+
		((col>>16)&0xFF)+','+
		((col>> 8)&0xFF)+','+
		(((col>>0)&0xFF)/255)+')';
}

function parseOneBitImageDataToDataUrl( enc:string, w:number, h:number, color0:number, color1:number ):string {
	const pixDat = hexDecodeBits(enc);
	
	const canv = document.createElement('canvas');
	canv.width = w;
	canv.height = h;
	const ctx = canv.getContext('2d');
	if( ctx == null ) throw new Error("No ctx from canvas!");
	let prevColor:number|null = null;
	for( let i=0, y=0; y < h; ++y ) {
		for( let x = 0; x < w; ++x, ++i ) {
			const col = pixDat[i] ? color1 : color0;
			if( col != prevColor ) ctx.fillStyle = numberToFillStyle(col);
			ctx.fillRect(x,y,1,1);
			prevColor = col;
		}
	}

	return canv.toDataURL();
}

interface BitImageInfo {
	bitstr : string;
	color0 : number;
	color1 : number;
	width  : number;
	height : number;
	originX: number;
	originY: number;
}

const oneBitImageDataRegex = /^bitimg:([^,]+),([0-9a-f]+)$/;
function parseBitImg( m:RegExpExecArray ):BitImageInfo {
	const modStrs = m[1].split(';');
	const bitStr:string = m[2];
	const modVals:KeyedList<any> = {}; // Actually strings!  But any makes |0 happy.
	const length = bitStr.length * 4;
	const defaultWidth = Math.sqrt(length), defaultHeight = length/defaultWidth;  
	for( let i = 0; i < modStrs.length; ++i ) {
		const p = modStrs[i].split('=',2);
		if( p.length == 2 ) {
			let v:any = p[1];
			if( v[0] == '0' && v[1] == 'x' ) {
				v = parseInt(v.substr(2, 16));
			}
			modVals[p[0]] = v;
		}
	}
	const width  = (modVals['width']  || defaultWidth )|0;
	const height = (modVals['height'] || defaultHeight)|0
	return {
		bitstr: bitStr,
		color0: modVals['color0']|0,
		color1: modVals['color1']|0,
		width : width,
		height: height,
		originX: (modVals['originX'] || width /2)|0,
		originY: (modVals['originY'] || height/2)|0,
	}
}

// Uhm, hrm, should we use ARGB or RGBA?

interface Icon {
	visualRef? : string;
	imageRef? : string;
	image : HTMLImageElement;
	// Origin, in image pixels, within the image.
	originX : number;
	originY : number;
	// Each image pixel = this many world length units
	scaleX : number;
	scaleY : number;
}

class EntityImageManager
{
	// Note that this all needs to be completely rewritten
	// in order to deal with non-bitimg: icons
	// and to take state, time, orientation into account
	
	public constructor( protected gameDataManager:GameDataManager ) { }
	
	// TODO: Use one set of ImageSlices using sheetRef
	// instead of having one set of ImageSlice<ImageURL>s and one set of ImageSlice<Image>s
	protected urlishImageCache:KeyedList<ImageSlice<string>> = {};
	protected getUrlishImage( ref:string ):ImageSlice<string> {
		if( this.urlishImageCache[ref] ) return this.urlishImageCache[ref];
		
		const bitImgRee = oneBitImageDataRegex.exec(ref);
		let xRef = ref;
		if( bitImgRee ) {
			const bitImgInfo = parseBitImg(bitImgRee);
			xRef = parseOneBitImageDataToDataUrl( bitImgInfo.bitstr, bitImgInfo.width, bitImgInfo.height, bitImgInfo.color0, bitImgInfo.color1 );
			return this.urlishImageCache[ref] = new ImageSlice(
				xRef, makeVector(bitImgInfo.originX, bitImgInfo.originY, 0),
				16, makeAabb(0,0,0, bitImgInfo.width,bitImgInfo.height,0)
			);
		} else {
			throw new Error(ref+" not parse!");
		}
	}
	
	protected iconCache:KeyedList<ImageSlice<HTMLImageElement>> = {};
	public getIconIfLoaded( visualRef:string, state:KeyedList<any>|undefined, time:number, orientation:Quaternion, preferredResolution:number, initiateFetch:boolean=false ):ImageSlice<HTMLImageElement>|undefined {
		if( visualRef == dat.wiredToggleBoxVisualRef ) {
			// Cheating for now!
			const switchState = state == undefined ? false : !!state['switchState'];
			visualRef = switchState ?
				dat.greenToggleBoxOnImgRef :
				dat.greenToggleBoxOffImgRef;
		}
		
		if( this.iconCache[visualRef] ) return this.iconCache[visualRef];
		
		if( initiateFetch ) this.fetchIcon(visualRef, state, time, orientation, preferredResolution);
		return undefined;
	}
	
	protected fetchImage( srcRef:string ):Promise<HTMLImageElement> {
		const img = imageFromUrl(srcRef)
		if( img.width == 0 ) {
			return new Promise( (resolve,reject) => {
				img.addEventListener('load', (loadEvent) => {
					resolve(img);
				});
				setTimeout(() => {reject("Timed out while waiting for image "+srcRef+" to load")}, 2000);
			});
		} else {
			return Promise.resolve(img);
		}
	}
	
	protected iconPromises:KeyedList<Promise<ImageSlice<HTMLImageElement>>> = {};
	public fetchIcon( visualRef:string, state:KeyedList<any>|undefined, time:number, orientation:Quaternion, preferredResolution:number ):Promise<ImageSlice<HTMLImageElement>> {
		if( this.iconPromises[visualRef] ) return this.iconPromises[visualRef];
		
		const refSheet = this.getUrlishImage(visualRef);
		return this.iconPromises[visualRef] = this.fetchImage(refSheet.sheet).then( (img) => {
			return this.iconCache[visualRef] = {
				sheetRef: refSheet.sheet,
				sheet: img,
				origin: refSheet.origin,
				resolution: refSheet.resolution,
				bounds: refSheet.bounds
			}
		});
		
		//return Promise.resolve(this.getIcon(visualRef, state, time, orientation, preferredResolution));
	}
	
	public fetchEntityIcon( entity:Entity, time:number, orientation:Quaternion, preferredResolution:number ):Promise<ImageSlice<HTMLImageElement>> {
		return this.gameDataManager.fetchObject<EntityClass>(entity.classRef).then( (entityClass) => {
			if( !entityClass.visualRef ) return Promise.resolve(EMPTY_IMAGE_SLICE);
			return this.fetchIcon( entityClass.visualRef, entity.state || {}, time, orientation, preferredResolution);
		});
	}
}

export class MazeView {
	protected _gameDataManager:GameDataManager|undefined;
	protected _entityImageManager:EntityImageManager|undefined;
	public constructor( public canvas:HTMLCanvasElement ) { }
	
	protected _viewage : ViewScene = { visualEntities: [] };
	public ppm = 16;

	public occlusionFillStyle:string = 'rgba(96,64,64,1)';

	protected get screenCenterX() { return this.canvas.width/2; }
	protected get screenCenterY() { return this.canvas.height/2; }
	
	public set gameDataManager(gdm:GameDataManager) {
		this._gameDataManager = gdm;
		this._entityImageManager = new EntityImageManager(gdm);
	}
	
	public getTileEntityAt( coords:Vector3D, tileSize:number=1 ):TileEntity|undefined {
		let closestMatchValue = 0;
		let closestMatch:TileEntity|undefined = undefined;
		const viewItems = this._viewage.visualEntities;
		for( let i in viewItems ) {
			const vi = viewItems[i];
			const te = vi.entity;
			const gdm = this._gameDataManager;
			if( te && gdm ) {
				const ec = gdm.getObjectIfLoaded<EntityClass>(te.classRef);
				if( ec && offsetAabbContainsVector(vi.position, ec.tilingBoundingBox, coords) ) {
					let matchValue = 1;
					if( ec.tilingBoundingBox.maxX-ec.tilingBoundingBox.minX == tileSize ) {
						++matchValue;
					}
					if( matchValue > closestMatchValue ) {
						closestMatch = {
							orientation: vi.orientation || Quaternion.IDENTITY,
							entity: te
						};
						closestMatchValue = matchValue;
					}
				}
			}
		}
		return closestMatch;
	}
	
	public clear():void {
		const ctx = this.canvas.getContext('2d');
		if( !ctx ) return;
		ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
	}

	protected drawRaster(rast:ShadeRaster, minDrawValue:number, maxDrawValue:number, fillStyle:string, drawMargin:boolean, borderColor?:string):void {
		const ctx = this.canvas.getContext('2d');
		if( !ctx ) return;
		const cx = this.canvas.width/2;
		const cy = this.canvas.height/2;
		const ppm = this.ppm;
		
		const canvWidth = this.canvas.width;
		const canvHeight = this.canvas.height;
		
		const vrWidth = rast.width, vrHeight = rast.height;
		const vrData = rast.data;
		ctx.fillStyle = fillStyle;

		if( borderColor ) {
			ctx.strokeStyle = borderColor;
			ctx.strokeRect(
				canvWidth /2 - rast.originX*ppm,
				canvHeight/2 - rast.originY*ppm,
				rast.width*ppm/rast.resolution,
				rast.height*ppm/rast.resolution
			)
		}
		
		if( drawMargin ) {
			const rastMinPx = canvWidth /2 - (rast.originX*ppm);
			const rastMinPy = canvHeight/2 - (rast.originY*ppm);
			
			const mx0 = Math.max(0, rastMinPx);
			const my0 = Math.max(0, rastMinPy);
			const mx1 = Math.min(canvWidth , rastMinPx + (rast.width /rast.resolution)*ppm);
			const my1 = Math.min(canvHeight, rastMinPy + (rast.height/rast.resolution)*ppm);
			
			ctx.fillRect(  0,   0, canvWidth    , my0           ); // Top
			ctx.fillRect(  0, my1, canvWidth    , canvHeight-my0); // Bottom
			ctx.fillRect(  0, my0, mx0          , my1-my0       ); // Left
			ctx.fillRect(mx1, my0, canvWidth-mx1, my1-my0       ); // Right
		}

		let i:number, y:number;
		const fillFog = function(x0:number, x1:number):void {
			ctx.fillRect(
				cx+ppm*(x0/rast.resolution - rast.originX),
				cy+ppm*( y/rast.resolution - rast.originY),
				ppm*(x1-x0) / rast.resolution,
				ppm         / rast.resolution
			);
		};
		
		const showValue = false; // Turn to true for debuggin'
		if( showValue ) ctx.strokeStyle = '#F0F'; // For le debug text
		for( i=0, y=0; y<vrHeight; ++y ) {
			let spanStart:number|null = null;
			for( let x=0; x<vrWidth; ++x, ++i ) {
				if( vrData[i] >= minDrawValue && vrData[i] <= maxDrawValue ) {
					if( spanStart == null ) spanStart = x;
				} else if( spanStart != null ) {
					fillFog(spanStart, x);
					spanStart = null;
				}
				if( showValue ) ctx.strokeText( ""+(vrData[i] > 9 ? 9 : vrData[i]), cx+ppm*(x/rast.resolution - rast.originX), 8+cy+ppm*( y/rast.resolution - rast.originY) );
			}
			if( spanStart != null ) {
				fillFog(spanStart, vrWidth);
			}
		}
	}
	
	protected drawOcclusionFog(viz:ShadeRaster):void {
		this.drawRaster( viz, VISIBILITY_VOID, VISIBILITY_NONE, this.occlusionFillStyle, true);
	}
	
	// TODO: Genericize the object draw list from CanvasWorldView and use it.
	protected draw():void {
		const ctx = this.canvas.getContext('2d');
		if( !ctx ) return;
		const eim = this._entityImageManager;
		const cx = this.canvas.width/2;
		const cy = this.canvas.height/2;
		const ppm = 16;
		if( eim ) for( let i in this._viewage.visualEntities ) {
			const item:RoomVisualEntity = this._viewage.visualEntities[i];
			const time = 0;
			if( !item.visualRef ) continue;
			const icon:ImageSlice<HTMLImageElement>|undefined = eim.getIconIfLoaded(
				item.visualRef, item.state, time, item.orientation || Quaternion.IDENTITY, 16,
				true);
			if( icon == null ) continue;
			const px = item.position.x * ppm + cx;
			const py = item.position.y * ppm + cy;
			const iconScale = ppm/icon.resolution;
			ctx.drawImage(
				icon.sheet,
				icon.bounds.minX, icon.bounds.minY, aabbWidth(icon.bounds), aabbHeight(icon.bounds),
				px + iconScale*(icon.bounds.minX - icon.origin.x),
				py + iconScale*(icon.bounds.minY - icon.origin.y),
				iconScale * aabbWidth(icon.bounds), iconScale * aabbHeight(icon.bounds),
			);
		}
		if(this._viewage.visibility) this.drawOcclusionFog(this._viewage.visibility);
	}
	
	protected redrawRequested:boolean = false;
	public requestRedraw():void {
		if( this.redrawRequested ) return;
		
		this.redrawRequested = true;
		// TODO: Skip drawing if not in viewport (but make sure it gets drawn when it is visible again!)
		window.requestAnimationFrame( () => {
			this.redrawRequested = false;
			this.clear();
			this.draw();
		});
	}
	
	public get viewScene() { return this._viewage; }
	
	public set viewScene(v:ViewScene) {
		this._viewage = v;
		this.requestRedraw();
	}
	
	public canvasPixelToWorldCoordinates(x:number, y:number, dest?:Vector3D ):Vector3D {
		const pdx = x - this.screenCenterX, pdy = y - this.screenCenterY;
		const ppm = this.ppm;
		return setVector( dest, pdx/ppm, pdy/ppm, 0 );
	}
}

function isAllZero( data:ArrayLike<number> ) {
	for( let i=0; i<data.length; ++i ) if( data[i] != 0 ) return false;
	return true;
}
function isAllNonZero( data:ArrayLike<number> ) {
	for( let i=0; i<data.length; ++i ) if( data[i] == 0 ) return false;
	return true;
}

const simulatorId = 'urn:uuid:002ae5c8-1c7f-470c-8b5d-cf79e58aa561';

enum DemoMode {
	PLAY = 0,
	EDIT = 1
}

interface ScalarIndicator {
	value : number|undefined;
}

interface ConsoleDialogBox extends DialogBox {
	inputElement:HTMLInputElement;
}

interface GameContext {
	gameDataManager : GameDataManager;
	entityImageManager : EntityImageManager;
}

interface SoundEffect {
	dataRef : string;
	volume? : number;
}

type GameContextListener = (ctx:GameContext)=>void;

function sExpressionToProgramExpressionRef(sExp:any[], gdm:GameDataManager):string {
	return gdm.tempStoreObject<esp.ProgramExpression>(
		esp.sExpressionToProgramExpression(sExp)
	);
}

class LevelSetterUpper extends SimulationUpdate {
	public constructor(sim:SimulationUpdateContext, state:SimulationState, public playerId:string, protected controllerDeviceId:string ) {
		super(sim, state);
	}
	
	public createNewPlayerEntity(newPlayerId:string):Entity {
		return {
			id: newPlayerId,
			classRef: dat.playerEntityClassId,
			desiresMaze1AutoActivation: true,
			storedEnergy: 100000,
			subsystems: this.makePlayerSubsystems(),
		};
	}
	
	public restartLevel():Promise<SimulationState> {
		const foundExistingPlayer = this.findRoomEntity(this.playerId)
		if( foundExistingPlayer ) {
			console.log("Killing existing player "+foundExistingPlayer.roomEntityId);
			this.killRoomEntity(foundExistingPlayer.roomRef, foundExistingPlayer.roomEntityId);
		}
		const newPlayerId = this.playerId = newUuidRef();
		let playerPlaced = false;
		
		const foundSpawnPoint = this.findRoomEntity(
			(path,entity) => entity.classRef == dat.spawnPointEntityClassId
		);
		if( !foundSpawnPoint ) {
			return Promise.reject("Failed to find spawn point for player!");
		}
		
		const playerEntity = this.createNewPlayerEntity(newPlayerId);
		try {
			this.placeItemSomewhereNear( playerEntity, foundSpawnPoint.roomRef, foundSpawnPoint.roomEntity.position );
		} catch( err ) {
			return Promise.reject(new Error("Failed to place player at spawn point "+foundSpawnPoint.roomEntityId));
		}
		console.log("Player placed near spawn point "+foundSpawnPoint.roomEntityId+", ID "+newPlayerId);
		playerPlaced = true;
		
		return Promise.resolve(this.initialSimulationState);
	}
	
	protected makePlayerSubsystems():KeyedList<EntitySubsystem> {
		return {
			[ESSKEY_PROXIMALEVENTDETECTOR]: {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/ProximalEventDetector",
				eventDetectedExpressionRef: sExpressionToProgramExpressionRef(
					['sendBusMessage', ['makeArray', '/controlleruplink/proximalevent', ['var', 'event']]],
					this.gameDataManager
				)
			},
			"rightarm": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/Appendage",
				maxReachDistance: 1,
			},
			"leftarm": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/Appendage",
				maxReachDistance: 1,
			},
			[ESSKEY_VISION]: {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/Vision",
				eyePositions: [
					makeVector(-1/8, -1/8, 0),
					makeVector(+1/8, -1/8, 0),
				],
				isEnabled: true,
				maxViewDistance: 32,
				minScanInterval: 1/60,
				sceneExpressionRef: sExpressionToProgramExpressionRef(
					['sendBusMessage', ['makeArray', '/controlleruplink/viewscene', ['var', 'viewScene']]],
					this.gameDataManager
				)
			},
			"controlleruplink": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/InterEntityBusBridge",
				forwardEntityPath: [ROOMID_EXTERNAL, this.controllerDeviceId],
			},
		}
	}
	
	public fixPlayer():Promise<SimulationState> {
		const playerRoomEntity = this.findRoomEntity(this.playerId);
		if( playerRoomEntity ) {
			this.updateRoomEntity( playerRoomEntity.roomRef, playerRoomEntity.roomEntityId, {
				subsystems: this.makePlayerSubsystems()
			});
			return Promise.resolve(this.initialSimulationState);
		} else {
			return this.restartLevel();
		}
	}
	
	public doUpdate():Promise<SimulationState> { throw new Error("Don't call this."); }
}

export class MazeDemo {
	public datastore : Datastore<Uint8Array>;
	public memoryDatastore : MemoryDatastore<Uint8Array>;
	public exportDatastore : MemoryDatastore<Uint8Array>;
	public gameDataManager : GameDataManager;
	public simulator : MazeSimulator|undefined;
	public canvas:HTMLCanvasElement;
	public soundPlayer:SoundPlayer;
	public view : MazeView;
	public playerId : string = 'no-player-id-set';
	public tabSwitchesMode : boolean = true;
	public soundEffectsEnabled : boolean = true;
	protected tickTimerId? : number;
	protected tickRate = 1/32;
	protected _demoMode:DemoMode = DemoMode.PLAY;
	protected deviceId : string = newUuidRef();
	
	public gameInterfaceElem : HTMLElement|undefined|null;
	public tilePaletteUi:TilePaletteUI;
	public maze1InventoryUi:TilePaletteUI;
	public consoleDialog?:ConsoleDialogBox;
	public winDialog?:EventDialogBox;
	public restartDialog?:EventDialogBox;
	public loadDialog?:DialogBox;
	public helpDialog?:DialogBox;
	public energyIndicator?:ScalarIndicator;
	
	public saveButton:HTMLButtonElement;
	public foundTriforceCount:number = 0;
	public currentLevelNumber:number = 0;
	public foundTriforceThisLevel:boolean = false;
	public logger:Logger = console;
	public loadingStatusUpdated:(text:string)=>any = (t)=>{};
	
	protected contextListeners:GameContextListener[] = [];
	public addContextListener(l:GameContextListener) {
		this.contextListeners.push(l);
	}
	
	protected set context(ctx:GameContext) {
		if( this.simulator ) this.simulator.gameDataManager = ctx.gameDataManager;
		if( this.view ) this.view.gameDataManager = ctx.gameDataManager;
		for( let l in this.contextListeners ) {
			this.contextListeners[l]( ctx );
		}
	}
	
	protected logLoadingStatus(stat:string, isError:boolean=false, err?:Error) {
		this.loadingStatusUpdated(stat);
		if( isError ) this.logger.error(stat, err || new Error(stat));
		else this.logger.log(stat);
	}
	
	protected set loadingStatus(stat:string) {
		this.loadingStatusUpdated(stat);
	}
	
	public get demoMode() { return this._demoMode; }
	public set demoMode(mode:number) {
		mode = mode % 2;
		if( mode == this._demoMode ) return;
		this._demoMode = mode;
		if( this._demoMode == DemoMode.EDIT ) {
			this.tilePaletteUi.element.style.display = "";
			this.maze1InventoryUi.element.style.display = "none";
		} else {
			this.tilePaletteUi.element.style.display = "none";
			this.maze1InventoryUi.element.style.display = "";
		}
	}
	public switchToNextMode() {
		this.demoMode += 1;
	}
	
	public startSimulation() {
		if( this.tickTimerId == undefined ) {
			this.tickTimerId = setInterval(this.tick.bind(this), 1000*this.tickRate);
		}
	}
	public stopSimulation():Promise<void> {
		if( this.tickTimerId != undefined ) {
			clearInterval(this.tickTimerId);
			this.tickTimerId = undefined;
		}
		return this.simulator ? this.simulator.currentStatePromise.then( () => {} ) : Promise.resolve();
	}
	
	protected tick() {
		if( this.simulator ) this.simulator.update().then( (newState) => {
			this.simulationUpdated(newState);
		});
	}
	
	protected prevUpdateTime:number|undefined = undefined;
	protected ups = 0;
	public simulationUpdated( state:SimulationState ) {
		const currentTime = new Date().valueOf()/1000; 
		if( this.prevUpdateTime != undefined ) {
			const interval = currentTime - this.prevUpdateTime;
			this.ups = 1/interval * 1/5 + this.ups * 4/5;
			this.setCounter('ups', this.ups.toFixed(2));
		}
		this.prevUpdateTime = currentTime;
		
		this.setCounter('physically-active-room', elementCount(state.physicallyActiveRoomIdSet || {}).toString() )
	}

	protected picking:boolean = false;

	// TODO: Make the key codes key_ constants
	// TODO: use keyActions for the other things, too.
	protected keyActions:KeyedList<string[]> = {
		// Keypad keys:
		33: ['right','up'],
		34: ['right','down'],
		35: ['left','down'],
		36: ['left','up'],
		
		// Arrows?
		37: ['left'],
		38: ['up'],
		39: ['right'],
		40: ['down'],
		
		// WASD
		87: ['up'],
		65: ['left'],
		83: ['down'],
		68: ['right'],
		
		[KEY_CTRL]: ['pick'],
	};
	
	protected keysDown:KeyedList<boolean> = {};
	protected keysUpdated() {
		let up=false,down=false,left=false,right=false;
		
		const actions:KeyedList<boolean> = {};
		for( let k in this.keysDown ) {
			const acts = this.keyActions[k];
			if( acts ) for( let a in acts ) {
				actions[acts[a]] = true;
			}
		}
		
		if( actions['right'] ) right = true;
		if( actions['left']  ) left  = true;
		if( actions['up']    ) up    = true;
		if( actions['down']  ) down  = true;
		
		if( left && right ) left = right = false;
		if( up && down ) up = down = false;
		
		let moveX = right ? +1 : left ? -1 : 0;
		let moveY = down  ? +1 : up   ? -1 : 0;
		
		if( this.simulator && this.playerId ) {
			this.enqueueInternalBusMessage([ROOMID_FINDENTITY, this.playerId], ["/desiredmovementdirection", moveX, moveY, 0]);
		}
		
		this.picking = actions['pick'];
	}
	
	// When keys are pressed in the main game interface
	public gameKeyDown(keyEvent:KeyboardEvent):void {
		if( this.keyActions[keyEvent.keyCode] ) {
			this.keysDown[keyEvent.keyCode] = true;
			this.keysUpdated();
			keyEvent.preventDefault();
		}
		if( keyEvent.keyCode >= KEY_0 && keyEvent.keyCode <= KEY_9 ) {
			const selectedIndex = keyEvent.keyCode - KEY_0;
			switch( this._demoMode ) {
			case DemoMode.EDIT:
				if( this.tilePaletteUi ) this.tilePaletteUi.selectSlot(selectedIndex);
				break;
			case DemoMode.PLAY:
				if( this.maze1InventoryUi ) this.maze1InventoryUi.selectSlot(selectedIndex);
				break;
			}
			keyEvent.preventDefault();
		}
	}
	public globalKeyUp(keyEvent:KeyboardEvent):void {
		if( this.keyActions[keyEvent.keyCode] ) {
			delete this.keysDown[keyEvent.keyCode];
			this.keysUpdated();
		}
	}
	
	// Keys pressed anywhere
	public globalKeyDown(keyEvent:KeyboardEvent):void {
		switch( keyEvent.keyCode ) {
		case KEY_TAB:
			if( this.tabSwitchesMode ) {
				this.switchToNextMode();
				keyEvent.preventDefault();
				return;
			}; break;
		case KEY_SLASH:
			this.popUpConsole("/");
			keyEvent.preventDefault();
			return;
		case KEY_BACKTICK:
			this.popUpConsole("");
			keyEvent.preventDefault();
			return;
		}
	}
	
	public saveGame():Promise<string> {
		if( !this.simulator ) throw new Error("Nothing to save!");
		return this.simulator.flushUpdates().then( (state) => {
			return storeObject<HardSimulationState>(state, this.datastore);
		});
	}
	public saveGame2(note:string):void {
		if(this.saveButton) this.saveButton.disabled = true;
		this.saveGame().then( (saveRef) => {
			const saveMeta = {
				note,
				date: new Date().toISOString(),
				saveRef: saveRef,
			};
			
			this.logger.log("Serialized as "+saveRef+"; uploading...");
			
			http.request(
				'POST', 'http://game21-data.nuke24.net/saves',
				{'content-type':'application/json'},
				encodeObject(saveMeta)
			).then( (res) => {
				if( res.statusCode != 200 ) {
					this.logger.error("Failed to save to website;", res.content);
				} else {
					this.logger.log("Saved "+saveRef+" to website");
				}
			});
			
			if( window.localStorage ) {
				const savesJson = window.localStorage.getItem("game21-local-saves");
				const saves:{note:string,date:string,saveRef:string}[] = savesJson ? JSON.parse(savesJson) : [];
				saves.push(saveMeta);
				window.localStorage.setItem("game21-local-saves", JSON.stringify(saves, null, "\t"));
			}
			
			// TODO: catch any rejects here and return them
			
			if(this.saveButton) this.saveButton.disabled = false;
		}).catch( (err) => {
			if(this.saveButton) this.saveButton.disabled = false;
			this.logger.error("Error saving!", err);
		});
	}
	
	protected sounds:KeyedList<SoundEffect> = {
		'jump': {dataRef: 'urn:bitprint:PUI5IOGTUW32PKDJXH2WPAIKF6ZV2UVH.5YEO5BYLXIINTBTLXFWIQ5QKOOA5O2CARTPMTZQ', volume: 0.25},
		'food-ate': {dataRef: 'urn:bitprint:52C7CJ3H23QPTH4ORAS4XMI2JIGKYOKC.F6NQEI6XJYNCSHQFDOGO3PWBUDX6ZOD6KJTYCWA', volume: 0.75},
		'key-got': {dataRef: 'urn:bitprint:S6K6KYKJVBNLIR5Y7MDQHMR4ORQZGYOE.AU73BOMZZKFBMGOS4CBJCGWVKGJW72PKW2UGNAY', volume: 0.125},
		'triforce-got': {dataRef: 'urn:bitprint:NLQVXM2OZGSHWVWJVUPBFIGKBJ4PLJ6N.L4IOHLRD5U57XEW4U4CI5TDFC4NGF6XVNGLSAPA'},
		'stick-got': {dataRef: 'urn:bitprint:RK2CXQIXPC6DX7E66AKWJFBPBHBZ6EJI.BYKJVUZFX4CFTFOVT4OXNDAOLJBJ3MHN7NN57GQ'},
		'door-opened': {dataRef: 'urn:bitprint:24QIYL5AH2ZEWUB4KYQSAWPYV43DOKKC.3WIXHFFFIT2ZK4D6HVGP52BIBRU5WIRK27BMWUA', volume: 0.5},
	}
	protected simpleEventSounds:KeyedList<SoundEffect> = {
		'jump': this.sounds['jump'],
		'door-opened': this.sounds['door-opened'],
	}
	protected itemSounds:KeyedList<SoundEffect> = {
		[dat.appleEntityClassId]: this.sounds['food-ate'],
		[dat.blueKeyEntityClassId]: this.sounds['key-got'],
		[dat.yellowKeyEntityClassId]: this.sounds['key-got'],
		[dat.redKeyEntityClassId]: this.sounds['key-got'],
		[dat.triforceEntityClassId]: this.sounds['triforce-got'],
		[dat.stick1EntityClassId]: this.sounds['stick-got'],
		[dat.stick2EntityClassId]: this.sounds['stick-got'],
	};
	
	public preloadSounds() {
		for( let k in this.sounds ) {
			this.soundPlayer.preloadSound(this.sounds[k].dataRef);
		}
	}
	
	protected playSound(f:SoundEffect|undefined) {
		if( !this.soundEffectsEnabled ) return;
		if( f == undefined ) return;
		this.soundPlayer.playSoundByRef(f.dataRef, f.volume);
	}
	
	protected died() {
		if( this.restartDialog && !this.restartDialog.isVisible ) {
			this.logger.log("You have run out of energy and died. :(");
			this.restartDialog.message = "You have run out of energy and died.";
			this.restartDialog.isVisible = true;
		}
	}
	
	protected handleBusMessage( msg:EntitySystemBusMessage, replyPath?:EntityPath ) {
		switch( msg[0] ) {
		case "/proximalevent":
			const evt:SimulationMessage = msg[1];
			switch( evt.classRef ) {
			case "http://ns.nuke24.net/Game21/SimulationMessage/SimpleEventOccurred":
				this.playSound( this.simpleEventSounds[evt.eventCode] );
				break;
			case "http://ns.nuke24.net/Game21/SimulationMessage/ItemPickedUp":
				this.playSound( this.itemSounds[evt.itemClassRef] );
				break;
			}
			break;
		case "/dying":
			this.died();
			break;
		case "/viewscene":
			const viewScene:ViewScene = msg[1];
			
			const invItems:PaletteItem[] = [];
			const selfState = viewScene.viewerState;
			if( selfState ) {
				const inv = selfState.maze1Inventory || {};
				for( let k in inv ) {
					invItems.push({key: k, entity: inv[k]});
					if( inv[k].classRef == dat.triforceEntityClassId && !this.foundTriforceThisLevel ) {
						// omg a triforce
						++this.foundTriforceCount;
						this.popUpWinDialog("You have found "+this.foundTriforceCount+" triforces!");
						this.foundTriforceThisLevel = true;
					}
				}
				if( this.energyIndicator ) this.energyIndicator.value = selfState.storedEnergy;
				if( selfState.storedEnergy < 1 ) {
					this.died();
				}
			} else {
				if( this.energyIndicator ) this.energyIndicator.value = undefined;
			}
			this.maze1InventoryUi.setAllSlots(invItems);
			
			const locationDiv = document.getElementById('camera-location-box');
			const cameraLoc = viewScene.viewerLocation;
			if( locationDiv ) {
				let locationNode = locationDiv.firstChild;
				if( locationNode == null ) locationDiv.appendChild(locationNode = document.createTextNode(""));
				if( cameraLoc ) {
					const p = cameraLoc.position;
					locationNode.nodeValue = cameraLoc.roomRef+" @ "+p.x.toFixed(3)+","+p.y.toFixed(3)+","+p.z.toFixed(3);
				} else {
					locationNode.nodeValue = "";
				}
			}
			
			if( cameraLoc ) {
				// Cursor may have moved relative to the world!
				this.maybePaint();
			}
			
			this.view.viewScene = viewScene;
			
			break;
		default:
			this.logger.warn("Received unrecognized message from simulation", msg, replyPath)
		}
	}
	
	public loadGame2(gdm:GameDataManager, simulationState:SimulationState, playerId:string, gameDescription:string):Promise<MazeSimulator> {
		this.logLoadingStatus('Waiting for current simulation step to complete...');
		
		const reloadSimulatorPromise = this.stopSimulation().then( () => {
			this.logLoadingStatus("Loading "+gameDescription+"...");
			this.context = {
				gameDataManager: gdm,
				entityImageManager: new EntityImageManager(gdm)
			};
			this.gameDataManager = gdm;
			this.simulator = new MazeSimulator(gdm, simulationState);
			this.simulator.majorStepDuration = this.tickRate;
			
			const thisDev:ExternalDevice = {
				onMessage: this.handleBusMessage.bind(this)
			}
			this.simulator.registerExternalDevice( this.deviceId, thisDev );
			//this.simulator.registerExternalDevice( 'ui', thisDev );
		});
		
		const loadPromise = reloadSimulatorPromise.then( () => gdm.cacheObjects([
			// TODO: Due to new simulator architecture I think this step can be taken out.
			dat.basicTileEntityPaletteRef // A thing whose ID tends to be hard coded around
		])).then(	() => {
			this.playerId = playerId;
			this.fixPlayer();
			this.startSimulation();
			return this.simulator;
		});
		
		loadPromise.then( (game) => {
			this.logger.log("Loaded "+gameDescription);
			this.loadingStatus = "";
			this.foundTriforceThisLevel = false;
		}).catch( (err) => {
			this.logger.error("Error loading "+gameDescription, err);
			this.loadingStatus = "Error loading!";
		});
		
		return loadPromise;
	}
	
	protected loadGame1(saveRef:string):Promise<MazeSimulator> {
		this.stopSimulation();
		if( saveRef.substr(saveRef.length-1) != '#' ) saveRef += "#";
		this.logLoadingStatus("Loading save "+saveRef+"...");
		return fetchObject(saveRef, this.datastore, true).then( (state:HardSimulationState&{playerEntityId?:string}) => {
			if( !state.rootRoomIdSet ) return Promise.reject(new Error("Oh no, save data all messed up? "+JSON.stringify(state)));
			const gdm = new GameDataManager(this.datastore, state.dataRef);
			return this.loadGame2(gdm, state, state.playerEntityId || dat.playerEntityId, saveRef);
		}, (err) => {
			this.logLoadingStatus("Error loading save "+saveRef+"!", true, err);
		});
	}
	
	public restartLevel():void {
		if( !this.simulator ) {
			this.logger.warn("Can't restart level; no simulator!")
			return;
		}
		this.simulator.doOneOffInterStateUpdate( (sim,state) => {
			const lsu = new LevelSetterUpper(sim,state,this.playerId,this.deviceId);
			return lsu.restartLevel().catch( (err) => {
				this.logLoadingStatus("No spawn point found!", true);
				return state;
			}).then( (state) => {
				if( this.restartDialog ) this.restartDialog.isVisible = false;
				this.playerId = lsu.playerId;
				return state;
			});
		});
	}
	
	/**
	 * If player does not exist, create one at a spawn point.
	 * 
	 * Either way, fix up the player entity to have the required subsystems.
	 **/
	protected fixPlayer():void {
		if( !this.simulator ) {
			this.logger.warn("Can't fix player; no simulator!")
			return;
		}
		this.simulator.doOneOffInterStateUpdate( (sim,state) => {
			const lsu = new LevelSetterUpper(sim,state,this.playerId,this.deviceId);
			return lsu.fixPlayer().catch( (err) => {
				this.logLoadingStatus("No spawn point found!", true);
				return state;
			}).then( (state) => {
				if( this.restartDialog ) this.restartDialog.isVisible = false;
				this.playerId = lsu.playerId;
				return state;
			});
		});
	}
	
	public loadGame(saveGameRef:string):Promise<MazeSimulator> {
		const levelRe = /^level(\d+)$/;
		let levelReMatch:RegExpExecArray|null;
		const tempGdm = new GameDataManager(this.datastore);
		
		if( saveGameRef == 'demo' ) {
			return dat.initData(tempGdm).then( () => this.loadGame2( tempGdm, {
				rootRoomIdSet: {[ dat.room1Id]: true},
				enqueuedActions: [],
				physicallyActiveRoomIdSet: {[dat.room1Id]: true},
				time: 0,
			}, dat.playerEntityId, "demo maze" ))
		} else if( saveGameRef == '' || saveGameRef == undefined ) {
			return Promise.resolve().then( () => this.generateAndLoadNewLevel(0))
		} else if( (levelReMatch = levelRe.exec(saveGameRef)) ) {
			// generateAndLoadNewLevel depends on some UI elements being set up, so defer it...
			const levelNumber = parseInt(levelReMatch[1]);
			return Promise.resolve().then( () => this.generateAndLoadNewLevel(levelNumber))
		} else {
			return this.loadGame1(saveGameRef);
		}
	}
	
	public generateAndLoadNewLevel(level:number):Promise<MazeSimulator> {
		let attempts = 0;
		let generateMaze:()=>Promise<void> = () => Promise.resolve(); // stupid ts compiler blah
		generateMaze = () => {
			const generator = new GraphMazeGenerator();
			if( level > 2 ) generator.requireKeys.push(ITEMCLASS_BLUEKEY);
			if( level > 6 ) generator.requireKeys.push(ITEMCLASS_YELLOWKEY);
			if( level > 12 ) generator.requireKeys.push(ITEMCLASS_REDKEY);
			generator.targetNodeCount = 8 + level;
			generator.complectificationFactor = 1/4 + Math.random()*Math.random()/2 + (1/3) * (level/50);
			
			const generationMessage = "Generating new level "+
				"requiring "+generator.requireKeys.length+" keys, "+
				"complectification factor: "+generator.complectificationFactor.toPrecision(2)+", "+
				"target node count: "+generator.targetNodeCount+
				(attempts > 0 ? " (attempt "+attempts+")" : "")+"...";
			this.logger.log(generationMessage);
			this.loadingStatus = "Generating level "+level+"...";
			if( this.winDialog ) this.winDialog.message = generationMessage;
			if( this.winDialog && this.winDialog.dismissButton ) this.winDialog.dismissButton.disabled = true;
			++attempts;
			
			const p = new Promise( (res,rej) => setTimeout(res,50) ).then( () => {
				const maze = generator.generate();
				this.logger.log("Generated maze graph with "+maze.nodes.length+" nodes, "+maze.links.length+" links");
				const gdm = new GameDataManager(this.datastore);
				const worldifier = new GraphWorldifier(gdm, maze);
				worldifier.gardenChance = Math.random()*Math.random();
				worldifier.caveChance = Math.min(1, level/10) * Math.random()
				worldifier.baseRootiness = Math.min(1, level/10) * Math.random()*Math.random()*3;
				worldifier.themeAreaSize = 4 + Math.random() * 8;
				return worldifier;
			}).then( (worldifier) => mazeToWorld(worldifier) ).then( ({gdm, playerId, startRoomRef}) => {
				this.hideDialog(this.winDialog);
				return this.loadGame2( gdm, {
					enqueuedActions: [],
					physicallyActiveRoomIdSet: {[startRoomRef]:true},
					rootRoomIdSet: {[startRoomRef]:true},
					time: 0,
				}, playerId, "generated maze" );
			}, (err) => {
				if( attempts < 50 ) {
					this.logger.warn("Maze generation failed; trying agin (attempt #"+attempts+"): ", err);
					return generateMaze();
				} else {
					const errorMessage = "Maze generation failed 50 times!  I guess my generator sucks!";
					this.logger.error(errorMessage);
					if( this.winDialog ) this.winDialog.message = errorMessage;
					this.loadingStatus = "Error generating maze!";
					return Promise.reject(err);
				}
			}).then( () => {
				this.currentLevelNumber = level;
			});
			return finalmente(p, () => {
				if( this.winDialog && this.winDialog.dismissButton ) this.winDialog.dismissButton.disabled = false;
			});
		}
		return generateMaze().then( () => this.simulator );
	}
	
	public hideDialog(d:DialogBox|undefined) {
		hideDialogBox(d);
		this.refocus();
	}
	
	/** Refocus game interface if dialog boxes are closed */
	public refocus() {
		if( dialogBoxIsVisible(this.winDialog) ) return;
		if( dialogBoxIsVisible(this.consoleDialog) ) return;
		if( dialogBoxIsVisible(this.helpDialog) ) return;
		if( dialogBoxIsVisible(this.loadDialog) ) return;
		this.focusGameInterface();
	}
	
	/*
	 * Close any dialog boxes and focus the game interface.
	 */
	public focusGameInterface() {
		hideDialogBox( this.winDialog );
		hideDialogBox( this.consoleDialog );
		hideDialogBox( this.helpDialog );
		hideDialogBox( this.loadDialog );
		if( this.gameInterfaceElem ) this.gameInterfaceElem.focus();
	}
	
	protected elementCache:KeyedList<HTMLElement|null> = {};
	
	protected getHtmlElement(key:string):HTMLElement|undefined|null {
		if( this.elementCache.hasOwnProperty(key) ) return this.elementCache[key];
		return this.elementCache[key] = document.getElementById(key);
	}
	
	public setCounter(elemId:string, value:string) {
		const counterElemId = elemId+'-counter';
		const counter = this.getHtmlElement(counterElemId);
		if( counter ) {
			if( !counter.firstChild ) counter.appendChild(document.createTextNode(""));
			counter.firstChild.nodeValue = value;
		}
	}
	
	public inspect(ref:string):Promise<any> {
		return this.gameDataManager.fetchObject(ref);
	}
	
	public exportCachedData() {
		const leObj:KeyedList<string> = {};
		for( let k in this.memoryDatastore.values ) {
			const v = this.memoryDatastore.values[k];
			try {
				const str = utf8Decode(v);
				leObj[k] = str;
			} catch( err ) { } // That's fine.  Just skip it.
		}
		
		storeObject( leObj, this.exportDatastore ).then( (urn) => {
			this.logger.log("JSON cache dump: ", urn);
		});
	}
	
	public importCacheStrings( exported:KeyedList<string> ) {
		for( let k in exported ) {
			const v = utf8Encode(exported[k]);
			this.memoryDatastore.put(k, v);
		}
	}
	
	protected eventToCanvasPixelCoordinates(evt:MouseEvent):Vector3D {
		const canv = this.canvas;
		return {
			x: evt.offsetX * (canv.width / canv.clientWidth),
			y: evt.offsetY * (canv.height / canv.clientHeight),
			z: 0
		};
	}

	public paintEntityClassRef:string|null = null;
	
	protected paintCoordinates:Vector3D|undefined;
	
	protected maybePaint() {
		const coords = this.paintCoordinates;
		if( coords ) {
			this.enqueueInternalBusMessage(
				[ROOMID_FINDENTITY, this.playerId],
				["/painttiletreeblock", coords.x, coords.y, coords.z, 1, this.paintEntityClassRef]
			);
		}
	}
	
	protected mouse1PreviouslyDown:boolean = true;
	protected mouse2PreviouslyDown:boolean = true;
	public handleMouseEvent(evt:MouseEvent):void {
		if( evt.buttons == 1 ) {
			const cpCoords = this.eventToCanvasPixelCoordinates(evt);
			const coords = this.view.canvasPixelToWorldCoordinates(cpCoords.x, cpCoords.y);
			switch( this._demoMode ) {
			case DemoMode.EDIT:
				if( this.picking ) {
					const entity:TileEntity|undefined = this.view.getTileEntityAt(coords, 1);
					this.tilePaletteUi.setSlot(this.tilePaletteUi.selectedSlotIndex, entity||null);
				} else {
					this.paintCoordinates = coords;
					this.maybePaint();
				}
				break;
			case DemoMode.PLAY:
				if( !this.mouse1PreviouslyDown ) {
					/*
					const itemKey = this.maze1InventoryUi.selectedItemKey;
					if( itemKey ) this.enqueueInternalBusMessage(
						[ROOMID_FINDENTITY, this.playerId],
						["/throwinventoryitem", this.maze1InventoryUi.selectedItemKey, coords.x, coords.y, coords.z]
					);
					*/
					this.enqueueInternalBusMessage(
						[ROOMID_FINDENTITY, this.playerId],
						['/rightarm/poke', coords.x, coords.y, coords.z]
					);
				}
				break;
			}
			this.mouse1PreviouslyDown = true;
		} else {
			this.paintCoordinates = undefined;
			this.mouse1PreviouslyDown = false;
		}
		if( evt.buttons == 2 ) {
			const cpCoords = this.eventToCanvasPixelCoordinates(evt);
			const coords = this.view.canvasPixelToWorldCoordinates(cpCoords.x, cpCoords.y);
			switch( this._demoMode ) {
			case DemoMode.PLAY:
				if( !this.mouse2PreviouslyDown ) {
					const itemKey = this.maze1InventoryUi.selectedItemKey;
					if( itemKey ) this.enqueueInternalBusMessage(
						[ROOMID_FINDENTITY, this.playerId],
						["/throwinventoryitem", this.maze1InventoryUi.selectedItemKey, coords.x, coords.y, coords.z]
					);
				}
				evt.preventDefault();
				break;
			}
			this.mouse2PreviouslyDown = true;
		} else {
			this.mouse2PreviouslyDown = false;
		}
	}
	
	protected commandHistory:string[] = [];
	protected commandHistoryIndex?:number;
	protected commandScratch:string = ""; // Anything entered before going into history
	
	protected addToCommandHistory(cmd:string) {
		if( this.commandHistory[this.commandHistory.length-1] == cmd ) return;
		this.commandHistory.push(cmd);
	}
	
	public moveThroughCommandHistory(delta:number) {
		if( delta == 0 ) return;
		delta = delta < 0 ? -1 : +1;
		
		if( this.commandHistoryIndex == null ) {
			this.commandHistoryIndex = this.commandHistory.length;
		}
		let newIndex = this.commandHistoryIndex + delta;
		newIndex = newIndex < 0 ? 0 : newIndex > this.commandHistory.length ? this.commandHistory.length : newIndex;
		if( newIndex == this.commandHistoryIndex ) return;
		
		if( newIndex < 0 ) newIndex = 0;
		if( newIndex > this.commandHistory.length ) newIndex = this.commandHistory.length;
		
		this.goToCommandHistory(newIndex);
	}
	
	public goToCommandHistory(index:number) {
		if(index == this.commandHistoryIndex) return;
		if(!this.consoleDialog) return; 
		const input = this.consoleDialog.inputElement;

		if( this.commandHistoryIndex == this.commandHistory.length ) {
			this.commandScratch = input.value;
		}
		
		this.commandHistoryIndex = index;
		const text = index == this.commandHistory.length ? this.commandScratch : this.commandHistory[index];
		input.value = text;
		input.setSelectionRange(text.length, text.length);
	}
	
	protected defaultNewRoomSize = 16;
	
	public goToCommandHistoryBeginning() { this.goToCommandHistory(0); }
	public goToCommandHistoryEnd() { this.goToCommandHistory(this.commandHistory.length); }
	
	public enqueueAction(act:SimulationAction):void {
		if( !this.simulator ) {
			this.logger.warn("Can't enqueue action; no simulation");
			return;
		}
		this.simulator.enqueueAction(act);
	}
	
	public enqueueInternalBusMessage(entityPath:EntityPath, busMessage:EntitySystemBusMessage, replyPath?:EntityPath):void {
		this.enqueueAction({
			classRef: "http://ns.nuke24.net/Game21/SimulationAction/InduceSystemBusMessage",
			entityPath: entityPath,
			busMessage,
			replyPath: replyPath,
		});
	}
	
	public submitConsoleCommand(cmd?:string) {
		if( cmd == null ) {
			if( !this.consoleDialog ) return;
			cmd = this.consoleDialog.inputElement.value;
			this.consoleDialog.inputElement.value = "";
			this.addToCommandHistory(cmd);
			this.goToCommandHistoryEnd();
		}
		cmd = cmd.trim();
		if( cmd == '' ) {
			// Do nothing, don't add to history
			return;
		} else if( cmd[0] == '#' ) {
			// ignore!
		} else if( cmd[0] == '/' ) {
			const tokens:Token[] = []
			const tokenizer = new Tokenizer( (token:Token):void => {
				if( token.type == TokenType.END_OF_FILE ) return;
				if( token.type == TokenType.COMMENT ) return;
				tokens.push(token)
			} );
			tokenizer.sourceLocation = {filename:"console-input", lineNumber: this.commandHistory.length+1, columnNumber: 1};
			tokenizer.text(cmd.substr(1));
			tokenizer.end();
			if( tokens.length == 0 ) {
				return;
				// do nothing!
			} else {
				const tt0 = tokens[0].text;
				doCommand: switch( tt0 ) {
				case 'set': case 'set/cache':
					if( !this.gameDataManager ) {
						this.logger.error("Can't update name mappings; no game loaded");
						break;
					}
					if( tokens.length == 3 ) {
						const name = tokens[1].text;
						const hardRef = tokens[2].text;
						if( tt0 == 'set/cache' ) {
							this.gameDataManager.cacheObjects([hardRef]).then( () => {
								this.gameDataManager.updateMap({[name]: hardRef});
							});
						} else {
							this.gameDataManager.updateMap({[name]: hardRef});
						}
					} else {
						this.logger.error("/set takes 2 arguments: /set <name> <hard reference>");
					}
					break;
				case 'get-hard-ref':
					if( !this.gameDataManager ) {
						this.logger.error("Can't look up hard refs; no game loaded");
						break;
					}
					for( let t=1; t<tokens.length; ++t ) {
						const name = tokens[t].text;
						this.gameDataManager.fetchHardRef(name).then( (hardRef) => {
							this.logger.log("/set/cache '"+name+"' '"+hardRef+"'");
						}).catch( (err) => {
							this.logger.error("Failed to look up hard ref for '"+name+"':", err);
						});
					};
					break;
				case 'cache':
					if( !this.gameDataManager ) {
						this.logger.error("Can't cache anything; no game loaded");
						break;
					}
					{
						const stuffToCache:string[] = [];
						for( let t=1; t<tokens.length; ++t ) {
							stuffToCache.push(tokens[t].text);
						}
						this.gameDataManager.cacheObjects(stuffToCache);
					}
					break;
				case 'next-level':
					this.generateAndLoadNewLevel(this.currentLevelNumber+1);
					break;
				case 'level':
					{
						if( tokens.length == 1 ) {
							this.logger.log("Current level: "+this.currentLevelNumber)
						} else if( tokens.length == 2 ) {
							this.generateAndLoadNewLevel(parseInt(tokens[1].text));
						} else {
							this.logger.error("/level takes zero or one argument: /level [<level number>]");
						}
					};
					break;
				case 'export-cached-data': case 'ecd':
					this.exportCachedData();
					break;
				case 'edit-mode':
					this.demoMode = DemoMode.EDIT;
					break;
				case 'play-mode':
					this.demoMode = DemoMode.PLAY;
					break;
				case 'save':
					{
						if( tokens.length == 2) {
							this.saveGame2(tokens[1].text);
							this.logger.log("Saving...");
						} else {
							this.logger.error("/save requires a single argument, e.g. /save \"a good save!\"");
						}
					}
					break;
				case 'show-console':
					this.popUpConsole("");
					break;
				case 'hide-console':
					this.hideDialog(this.consoleDialog);
					break;
				case 'echo':
					{
						const texts:string[] = [];
						for( let i=1; i<tokens.length; ++i ) texts.push(tokens[i].text);
						this.logger.log.apply(this.logger, texts );
					}
					break;
				case 'load':
					{
						if( tokens.length != 2 ) {
							this.logger.error("Load takes a single argument: <savegame URI>");
							//e.g. urn:sha1:53GHW7DMQF472PTXLWKKE25BKUJXOTXZ#
							break doCommand;
						}
						this.loadGame(tokens[1].text);
					}
					break;
				case 'set-tile-palette-slot':
					{
						let slotIndex:number = this.tilePaletteUi.selectedSlotIndex;
						let classRef:string;
						if( tokens.length == 3 ) {
							slotIndex = parseInt(tokens[1].text)|0;
							classRef = tokens[2].text;
						} else if( tokens.length == 2 ) {
							classRef = tokens[1].text;
						} else {
							this.logger.error("set-tile-palette-slot takes 1 or 2 arguments: [<slot number>] <entity class ref>");
							break;
						}
						this.tilePaletteUi.setSlot(slotIndex, classRef);
					}
					break;
				case 'default-room-size':
					{
						if( tokens[1] ) {
							this.defaultNewRoomSize = +tokens[1].text;
						}
						this.logger.log("Default room size is now "+this.defaultNewRoomSize);
					}
					break;
				case 'create-new-room':
					{
						const newRoomUuid = newUuidRef();
						this.logger.log("New room ID:", newRoomUuid);
						const size = tokens[2] ? +tokens[2].text : this.defaultNewRoomSize;
						this.enqueueInternalBusMessage([ROOMID_SIMULATOR], ["/create-room", newRoomUuid, size]);
					}
					break;
				case 'connect-new-room': case 'dig-new-room': case 'dnr':
					{
						const currentLocation = this.view.viewScene.viewerLocation;
						if( !currentLocation || !currentLocation.roomRef ) {
							this.logger.error("Can't dig to new room; current room ID not known.");
							break doCommand;
						}
						if( tokens.length != 2 ) {
							this.logger.error("/connect-new-room takes 1 argument: <direction (t,l,r,b,a,z)>");
							break doCommand;
						}
						const newRoomUuid = newUuidRef();
						const dir = tokens[1].text;
						this.logger.log("New room ID:", newRoomUuid);
						this.enqueueInternalBusMessage([ROOMID_SIMULATOR], ["/create-room", newRoomUuid, this.defaultNewRoomSize]);
						this.enqueueInternalBusMessage([ROOMID_SIMULATOR], ["/connect-rooms", currentLocation.roomRef, dir, newRoomUuid]);
					}
					break;
				case 'cr': case 'connect-rooms':
					{
						if( tokens.length != 4 ) {
							this.logger.error("/cr takes 3 arguments: <room 1 ID> <direction (t,l,r,b,a,z)> <room2 ID>");
							break doCommand;
						}
						const roomAId = tokens[1].text;
						const dirName = tokens[2].text;
						const roomBId = tokens[3].text;
						this.enqueueInternalBusMessage([ROOMID_SIMULATOR], ["/connect-rooms", roomAId, dirName, roomBId]);
					}
					break;
				case 'restart-level':
					this.restartLevel();
					break;
				case 'sound-effects':
					if( tokens.length == 1 ) {
					} else if( tokens.length == 2 ) {
						const t = tokens[1].text.trim().toLowerCase();
						let v:boolean;
						switch( t ) {
						case '0': case 'off': case 'false': case 'disabled':
							v = false; break;
						case '1': case 'on': case 'true': case 'enabled':
							v = true; break;
						default:
							this.logger.error("Bad on/off value: '"+t+"'");
							break doCommand;
						}
						this.soundEffectsEnabled = v;
					} else {
						this.logger.error("Usage: /sound-effects [on|off]");
						break;
					}
					this.logger.log("Sound effects are "+(this.soundEffectsEnabled ? "enabled" : "disabled"));
					break;
				case 'vomit':
					this.enqueueInternalBusMessage([ROOMID_FINDENTITY, this.playerId], ["/vomit"]);
					break;
				case 'give':
					if( tokens.length == 2 ) {
						this.enqueueInternalBusMessage([ROOMID_FINDENTITY, this.playerId], ["/give", tokens[1].text]);
					} else {
						this.logger.error("/give takes 1 argument: <entity class ref>.  e.g. '/give urn:uuid:4f3fd5b7-b51e-4ae7-9673-febed16050c1'");
					}
					break;
				default:
					this.logger.error("Unrecognized command: /"+tokens[0].text);
					break;
				}
			}
		}
	}
	
	public popUpConsole(initialText:string) {
		if( !this.consoleDialog ) return;
		this.goToCommandHistoryEnd();
		this.consoleDialog.inputElement.value = initialText;
		this.consoleDialog.setVisible(true);
		this.consoleDialog.inputElement.setSelectionRange(initialText.length,initialText.length);
		this.consoleDialog.inputElement.focus();
	}
	
	public popUpWinDialog(text:string) {
		if( this.winDialog ) {
			this.logger.log(text);
			this.winDialog.message = text;
			this.winDialog.setVisible(true);
		} else {
			this.logger.log(text+"\nBut there's no win dialog.  Type '/next-level' to go to the next level");
		}
	}
}

export interface SaveGame {
	gameDataRef: string,
	rootRoomId: string,
	playerId: string,
}

class DialogBox {
	public constructor( public element:HTMLElement ) { }
	
	public get isVisible() {
		return this.element.style.display != 'none';
	}
	public set isVisible(v:boolean) {
		this.setVisible(v);
	}
	
	/**
	 * Always use demo.hideDialog so that focus can be put back on game interface!
	 * when no dialogs are visible!
	 */
	public setVisible(viz:boolean) {
		this.element.style.display = viz ? "" : "none";
	}
}

function dialogBoxIsVisible(db:DialogBox|undefined) {
	return db != undefined && db.isVisible;
}
function hideDialogBox(db:DialogBox|undefined) {
	if( db ) db.setVisible(false);
}

class EventDialogBox extends DialogBox {
	public messageAreaElement:HTMLElement|undefined|null;
	public dismissButton:HTMLButtonElement|undefined|null;
	
	public set message(text:string) {
		const e = this.messageAreaElement;
		if( e ) {
			while( e.firstChild ) e.removeChild(e.firstChild);
			const p = document.createElement('p');
			p.appendChild(document.createTextNode(text));
			e.appendChild(p);
		}
	}
	
	public setVisible(viz:boolean) {
		super.setVisible(viz);
		if( viz && this.dismissButton ) this.dismissButton.focus();
	}
}

class TileEntityRenderer {
	protected entityImageManager:EntityImageManager;
	public constructor( protected gameDataManager:GameDataManager ) {
		this.entityImageManager = new EntityImageManager(gameDataManager);
	}
	
	protected imageCache:KeyedList<ImageSlice<HTMLImageElement>> = {};
	protected entityClassUrlishIconPromises:KeyedList<Promise<ImageSlice<HTMLImageElement>>> = {};
	
	protected renderEntity(position:Vector3D, orientation:Quaternion, ppm:number, entity:Entity, ctx:CanvasRenderingContext2D):Promise<void> {
		return this.gameDataManager.fetchObject<EntityClass>( entity.classRef ).then( (entityClass) => {
			if( entityClass.visualRef ) {
				return this.entityClassRefIcon(entity.classRef).then( (icon) => {
					const iconScale = ppm / icon.resolution;
					ctx.drawImage(
						icon.sheet,
						icon.bounds.minX, icon.bounds.minY, aabbWidth(icon.bounds), aabbHeight(icon.bounds),
						position.x*ppm + iconScale*(icon.bounds.minX - icon.origin.x),
						position.y*ppm + iconScale*(icon.bounds.minY - icon.origin.y),
						iconScale * aabbWidth(icon.bounds), iconScale * aabbHeight(icon.bounds),
					)
				});
			}
			
			const renderPromises:Promise<undefined>[] = [];
			eachSubEntity(position, orientation, entity, this.gameDataManager, (subPos, subOri, subEnt) => {
				renderPromises.push(this.renderEntity(subPos, subOri, ppm, subEnt, ctx));
			});
			return Promise.all(renderPromises).then( () => {} );
		});
	}
	
	public entityClassRefIcon(entityClassRef:string):Promise<ImageSlice<HTMLImageElement>> {
		if( this.entityClassUrlishIconPromises.hasOwnProperty(entityClassRef) ) {
			return this.entityClassUrlishIconPromises[entityClassRef];
		}
		return this.gameDataManager.fetchObject<EntityClass>( entityClassRef ).then( (entityClass) => {
			if( entityClass.visualRef ) {
				return this.entityImageManager.fetchIcon(entityClass.visualRef, {}, 0, Quaternion.IDENTITY, 32);
			} else if( entityClass.structureType != StructureType.INDIVIDUAL ) {
				const canv:HTMLCanvasElement = document.createElement('canvas');
				const vbb = entityClass.visualBoundingBox;
				const maxCanvWidth = 32, maxCanvHeight = 32;
				const scale = Math.min(maxCanvWidth / aabbWidth(vbb), maxCanvHeight / aabbHeight(vbb) );
				canv.width  = (scale * aabbWidth(vbb))|0;
				canv.height = (scale * aabbHeight(vbb))|0;
				const ctx = canv.getContext('2d');
				if( ctx == null ) return Promise.reject(new Error("Failed to create 2d rendering context"));
				return this.renderEntity( makeVector(aabbWidth(vbb)/2,aabbHeight(vbb)/2,0), Quaternion.IDENTITY, scale, {classRef: entityClassRef}, ctx ).then( () => {
					const imgUrl = canv.toDataURL();
					return {
						bounds: { minX: 0, minY: 0, minZ: 0, maxX: canv.width, maxY: canv.height, maxZ: 0 },
						origin: { x:canv.width/2, y:canv.height/2, z:0},
						resolution: 1/scale,
						sheetRef: imgUrl,
						sheet: imageFromUrl(imgUrl),
					}
				});
			}
			return Promise.resolve(EMPTY_IMAGE_SLICE);
		});
	}
	
	public entityIcon( entity:Entity, orientation:Quaternion):Promise<ImageSlice<HTMLImageElement>> {
		if( entity == null ) return Promise.resolve(EMPTY_IMAGE_SLICE);
		return this.entityClassRefIcon(entity.classRef);
	}
}

export function startDemo(canv:HTMLCanvasElement, saveGameRef?:string, loadingStatusUpdated:(text:string)=>any = (t)=>{}, cacheStrings:KeyedList<string>={} ) : MazeDemo {
	const dataIdent = sha1Urn;
	const ds2:Datastore<Uint8Array> = HTTPHashDatastore.createDefault();
	const ds1:Datastore<Uint8Array> = window.localStorage ? new CachingDatastore(dataIdent,
		new BrowserStorageDatastore(dataIdent, window.localStorage),
		ds2
	) : ds2;
	const memds = new MemoryDatastore(dataIdent);
	const expds = new MemoryDatastore(dataIdent);
	const ds:Datastore<Uint8Array> = new CachingDatastore(dataIdent,
		memds,
		new MultiDatastore(dataIdent, [ds1], [expds])
	);
	
	const v = new MazeView(canv);
	
	const demo = new MazeDemo();
	demo.soundPlayer = new SoundPlayer(ds);
	demo.preloadSounds();
	demo.canvas = canv;
	demo.datastore = ds;
	demo.memoryDatastore = memds;
	demo.exportDatastore = expds;
	demo.view = v;
	demo.loadingStatusUpdated = loadingStatusUpdated;
	demo.importCacheStrings(cacheStrings);
	
	const gameLoaded = demo.loadGame(saveGameRef || "level0");
	
	canv.addEventListener('mousedown', demo.handleMouseEvent.bind(demo));
	canv.addEventListener('contextmenu', demo.handleMouseEvent.bind(demo)); // Right clicks
	canv.addEventListener('mouseup'  , demo.handleMouseEvent.bind(demo));
	canv.addEventListener('mousemove', demo.handleMouseEvent.bind(demo));
	
	const tpArea = document.getElementById('tile-palette-area');
	if( tpArea ) {
		const tpUi = new TilePaletteUI( 16 );
		const invUi = new TilePaletteUI(4);
		tpUi.element.style.display = 'none';
		demo.tilePaletteUi = tpUi;
		demo.maze1InventoryUi = invUi;
		tpUi.on('select', (index:number, te:TileEntity|undefined|null) => {
			demo.paintEntityClassRef = te ? te.entity.classRef : null;
		});
		tpArea.appendChild( invUi.element );
		tpArea.appendChild( tpUi.element );
		gameLoaded.then( () => {
			const entityRenderer = new TileEntityRenderer(demo.gameDataManager);
			invUi.entityRenderer = tpUi.entityRenderer = (ent:Entity, orientation:Quaternion):Promise<string|null> => {
				return entityRenderer.entityIcon(ent, orientation).then( (icon) => icon.sheetRef );
			};
			const initialPaletteEntityClassRefs:(string|null)[] = [
				null, dat.brikEntityClassId, dat.bigBrikEntityClassId,
				dat.bigYellowBrikEntityClassId, dat.vines1EntityClassId,
				dat.backLadderEntityClassId, dat.plant1EntityClassId,
				dat.doorFrameEntityClassId,
				dat.latticeColumnRightBlockEntityClassId,
				dat.latticeColumnLeftBlockEntityClassId,
				dat.latticeColumnBgRightBlockEntityClassId,
				dat.latticeColumnBgLeftBlockEntityClassId,
			];
			for( let i=0; i<initialPaletteEntityClassRefs.length; ++i ) {
				tpUi.setSlot(i, initialPaletteEntityClassRefs[i]);
			}
		});
	}
	
	const butta = document.getElementById('button-area');
	if( butta ) {
		const targetEntityIdBox:HTMLSelectElement = document.createElement("select");
		targetEntityIdBox.value = dat.door3EntityId;
		const selectable:KeyedList<string> = {
			"Door": dat.door3EntityId,
			"Lift": dat.platformEntityId
		}
		
		for( let s in selectable ) {
			const opt = document.createElement("option");
			opt.value = selectable[s];
			opt.appendChild(document.createTextNode(s));
			targetEntityIdBox.appendChild(opt);
		}
		
		const openDoorButton = document.createElement('button');
		openDoorButton.appendChild(document.createTextNode("Up"));
		openDoorButton.onclick = () => {
			demo.enqueueInternalBusMessage(
				[ROOMID_FINDENTITY, targetEntityIdBox.value],
				["/desiredmovementdirection", 0, -1, 0]
			);
		}
		
		const closeDoorButton = document.createElement('button');
		closeDoorButton.appendChild(document.createTextNode("Down"));
		closeDoorButton.onclick = () => {
			demo.enqueueInternalBusMessage(
				[ROOMID_FINDENTITY, targetEntityIdBox.value],
				["/desiredmovementdirection", 0, +1, 0]
			);
		}
		
		const udGroup:HTMLElement = document.createElement("fieldset");
		udGroup.appendChild(targetEntityIdBox);
		udGroup.appendChild(openDoorButton);
		udGroup.appendChild(closeDoorButton);
		
		butta.appendChild(udGroup);
		
		const saveButton = demo.saveButton = document.createElement("button");
		saveButton.appendChild(document.createTextNode("Save"));
		saveButton.onclick = () => {
			const saveNote = window.prompt("Note");
			if( saveNote == null || saveNote.length == 0 ) return;
			saveButton.disabled = true;
			demo.saveGame2(saveNote);
		};
		
		butta.appendChild(saveButton);
		
		const loadDialogElem = document.getElementById('load-dialog');
		if( loadDialogElem ) {
			const loadDialog = demo.loadDialog = new DialogBox(loadDialogElem);
			const loadButton = document.createElement("button");
			loadButton.appendChild(document.createTextNode("Load..."));
			loadButton.onclick = () => {
				loadButton.disabled = true;
				
				const loadList = document.getElementById('load-list');
				if( loadList ) { 
					while( loadList.firstChild ) loadList.removeChild(loadList.firstChild);
					
					const savesJson = window.localStorage.getItem("game21-local-saves");
					const saves:{note:string,date:string,saveRef:string}[] = savesJson ? JSON.parse(savesJson) : [];
					for( let s in saves ) {
						const save = saves[s];
						const loadItem = document.createElement('li');
						loadItem.appendChild(document.createTextNode(save.note+" - "+save.date));
						loadItem.onclick = () => {
							demo.hideDialog(loadDialog);
							loadButton.disabled = false;
							demo.loadGame(save.saveRef);
						}
						loadList.appendChild(loadItem);
					}
				}
				
				loadDialog.setVisible(true);
			}
			
			const cancelLoadButton = document.getElementById('load-cancel-button');
			if( cancelLoadButton ) {
				cancelLoadButton.onclick = () => {
					loadDialogElem.style.display = 'none';
					loadButton.disabled = false;
				};
			}
			
			butta.appendChild(loadButton);
		}
		
		const helpDialogElement = document.getElementById('help-dialog');
		if( helpDialogElement ) {
			const helpDialog = demo.helpDialog = new DialogBox(helpDialogElement);
			const helpButton = document.createElement('button');
			helpButton.appendChild(document.createTextNode("Help!"));
			helpButton.onclick = () => helpDialog.setVisible(true);
			const closeHelpButton = document.getElementById('help-close-button');
			if( closeHelpButton ) closeHelpButton.onclick = () => demo.hideDialog(helpDialog);
			butta.appendChild(helpButton);
		}
	}
	
	const gameInterfaceElem = demo.gameInterfaceElem = document.getElementById('game-interface');
	if( gameInterfaceElem ) {
		gameInterfaceElem.addEventListener('keydown', demo.gameKeyDown.bind(demo), true);
		//gameInterfaceElem.addEventListener('keyup', demo.gameKeyUp.bind(demo), true);
		gameInterfaceElem.focus();
	} else {
		console.warn("No game interface element!  Binding key listeners to window");
		window.addEventListener('keydown', demo.gameKeyDown.bind(demo));
		//window.addEventListener('keyup', demo.gameKeyUp.bind(demo));
	}
	window.addEventListener('keydown', demo.globalKeyDown.bind(demo));
	window.addEventListener('keyup', demo.globalKeyUp.bind(demo));
	
	const winDialogElem = document.getElementById('win-dialog');
	if( winDialogElem ) {
		const winDialog:EventDialogBox = demo.winDialog = new EventDialogBox(winDialogElem);
		winDialog.messageAreaElement = document.getElementById('win-dialog-message-area');
		const winButtonArea = document.getElementById('win-dialog-button-area');
		
		const dismissWinDialog = () => {
			demo.generateAndLoadNewLevel(demo.currentLevelNumber+1);
		}
		
		if( winButtonArea ) {
			const nextLevelButton = winDialog.dismissButton = document.createElement('button');
			nextLevelButton.appendChild(document.createTextNode('Next level!'));
			nextLevelButton.onclick = dismissWinDialog;
			winButtonArea.appendChild(nextLevelButton);
		}
		
		winDialogElem.addEventListener('keydown', (keyEvent:KeyboardEvent) => {
			if( keyEvent.keyCode == KEY_ESC || keyEvent.keyCode == KEY_ENTER ) {
				dismissWinDialog();
				keyEvent.preventDefault();
				keyEvent.stopPropagation();
			}
		});
	}
	
	const restartDialogElem = document.getElementById('restart-dialog');
	if( restartDialogElem ) {
		const restartDialog:EventDialogBox = demo.restartDialog = new EventDialogBox(restartDialogElem);
		restartDialog.messageAreaElement = document.getElementById('restart-dialog-message-area');
		const restartButtonArea = document.getElementById('restart-dialog-button-area');
		
		const dismissRestartDialog = () => {
			demo.restartLevel();
		}
		
		if( restartButtonArea ) {
			const restartLevelButton = restartDialog.dismissButton = document.createElement('button');
			restartLevelButton.appendChild(document.createTextNode('Respawn'));
			restartLevelButton.onclick = dismissRestartDialog;
			restartButtonArea.appendChild(restartLevelButton);
		}
		
		restartDialogElem.addEventListener('keydown', (keyEvent:KeyboardEvent) => {
			if( keyEvent.keyCode == KEY_ESC || keyEvent.keyCode == KEY_ENTER ) {
				dismissRestartDialog();
				keyEvent.preventDefault();
				keyEvent.stopPropagation();
			}
		});
	}
	
	const consoleDialogElem = document.getElementById('console-dialog');
	if( consoleDialogElem ) {
		const consoleDialog = demo.consoleDialog = <ConsoleDialogBox>new DialogBox(consoleDialogElem);
		consoleDialog.inputElement = <HTMLInputElement>document.getElementById('console-input');
		consoleDialog.inputElement.addEventListener('keydown', (keyEvent:KeyboardEvent) => {
			if( keyEvent.keyCode == KEY_UP ) {
				demo.moveThroughCommandHistory(-1);
				keyEvent.preventDefault();
				keyEvent.stopPropagation();
			} else if( keyEvent.keyCode == KEY_DOWN ) {
				demo.moveThroughCommandHistory(+1);
				keyEvent.preventDefault();
				keyEvent.stopPropagation();
			//} else if( keyEvent.keyCode == 36 ) {
			//	demo.goToCommandHistoryBeginning();
			//} else if( keyEvent.keyCode == 35 ) {
			//	demo.goToCommandHistoryEnd();
			} else if( keyEvent.keyCode == KEY_ENTER ) {
				demo.submitConsoleCommand.bind(demo)();
				keyEvent.preventDefault();
				keyEvent.stopPropagation();
			}
		});
		
		const consoleCloseButton = document.getElementById('console-close-button')
		if( consoleCloseButton ) consoleCloseButton.onclick = () => demo.hideDialog(consoleDialog);
		consoleDialogElem.addEventListener('keydown', (keyEvent:KeyboardEvent) => {
			if( keyEvent.keyCode == KEY_ESC ) {
				demo.hideDialog(consoleDialog);
			}
			// Prevent any keys from propagating to the window and messing up our game
			keyEvent.stopPropagation();
		}, false);
		// Why did I need this?
		consoleDialogElem.addEventListener('keyup', (keyEvent:KeyboardEvent) => keyEvent.preventDefault());
		
		// Stand firm for what you believe in, until and unless experience proves you wrong.
		// Remember, when the emperor looks naked, the emperor *is* naked.
		// The truth and a lie are not sort of the same thing.
		// And there is no aspect, no facet, no moment of life that can't be improved with pizza.
		
		const loggers:Logger[] = [console];
		const htmlConsoleElement = document.getElementById('console-output');
		if( htmlConsoleElement ) {
			const hashUrnRegex = /^(urn:(?:sha1|bitprint):[^#]+)(\#.*)?$/;
			const domLogger = new DOMLogger(htmlConsoleElement);
			domLogger.fragReplacer = (thing:any) => {
				if( typeof thing == 'string' ) {
					let m:RegExpExecArray|null;
					if( (m = hashUrnRegex.exec(thing)) ) {
						const dataUrn = m[1];
						const target = demo.datastore.get(dataUrn);
						const linkUrl = target ?
							"data:application/json;base64,"+base64Encode(target) :
							"http://game21-data.nuke24.net/uri-res/raw/"+encodeURIComponent(dataUrn)+"/thing.txt";
						const fragElem = document.createElement('span');
						const linkElem = document.createElement('a');
						linkElem.href = linkUrl;
						linkElem.appendChild(document.createTextNode(m[1]));
						fragElem.appendChild(linkElem);
						if( m[2] && m[2].length > 0 ) fragElem.appendChild(document.createTextNode(m[2]));
						return [fragElem];
					}
				}
				return undefined;
			}
			loggers.push(domLogger);
		}
		demo.logger = new MultiLogger(loggers);
	}
	
	const inventoryDialogElement = document.getElementById('inventory-dialog');
	if( inventoryDialogElement ) {
		inventoryDialogElement.style.display = 'none';
		const ui = new StorageCompartmentContentUI();
		demo.addContextListener( (ctx) => {
			ui.entityRenderer = (entity:Entity) => ctx.entityImageManager.fetchEntityIcon(entity, 0, Quaternion.IDENTITY, 32);
		});
		/*
		// Let's just show /something/ for starts:
		ui.items = [
			{ classRef: dat.playerEntityClassId },
			{ classRef: dat.vines1EntityClassId },
		]
		inventoryDialogElement.appendChild(ui.element);
		*/
	}
	
	const energyBarElement = document.getElementById('energy-bar');
	const energyCounterElement = document.getElementById('energy-counter');
	const energyCounterTextNode:Node|undefined = energyCounterElement && energyCounterElement.firstChild.nodeType == Node.TEXT_NODE ?
		energyCounterElement.firstChild : undefined;
	if( energyBarElement ) {
		demo.energyIndicator = {
			set value(v:number|undefined) {
				if( energyBarElement ) energyBarElement.style.width = (v == undefined ? 0 : v * 400 / 100000)+'px';
				if( energyCounterTextNode ) energyCounterTextNode.nodeValue = (v == undefined ? "--" : Math.round(v).toFixed(0));
			}
		}
		demo.energyIndicator.value = undefined;
	}
	
	return demo;
}
