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
import KeyedList from './KeyedList';
import Vector3D from './Vector3D';
import { makeVector, setVector, vectorToString, ZERO_VECTOR } from './vector3ds';
import { pickOne } from './graphmaze/picking';
import {
	accumulateVector, addVector, subtractVector, scaleVector, normalizeVector,
	vectorLength, vectorIsZero, dotProduct, roundVectorToGrid
} from './vector3dmath';
import AABB from './AABB';
import {
	makeAabb, aabbWidth, aabbHeight, aabbDepth,
	aabbAverageX, aabbAverageY, aabbAverageZ,
	aabbContainsVector, aabbIntersectsWithOffset, offsetAabbContainsVector
} from './aabbs';
import Quaternion from './Quaternion';
import TransformationMatrix3D from './TransformationMatrix3D';
import SceneShader, { ShadeRaster, VISIBILITY_VOID, VISIBILITY_NONE, VISIBILITY_MIN } from './SceneShader';
import { uuidUrn, newType4Uuid } from '../tshash/uuids';
import {
	makeTileTreeRef, makeTileEntityPaletteRef, eachSubEntity, eachSubEntityIntersectingBb, connectRooms,
	getEntitySubsystem, setEntitySubsystem, enqueueInternalBusMessage
} from './worldutil';
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
import EntitySystemBusMessage, { MessageBusSystem } from './EntitySystemBusMessage';
import EntitySubsystem, {
	ProximalEventDetector,
	ESSKEY_PROXIMALEVENTDETECTOR
} from './EntitySubsystem';
import ImageSlice from './ImageSlice';
import { EMPTY_IMAGE_SLICE, imageFromUrl } from './images';
import { rewriteTileTree } from './tiletrees';

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
	InternalBusMessageReceived,
	ProximalSimulationMessage,
} from './SimulationMessage';
import {
	EntityPath,
	EntityCommandData,
	SimulationAction,
	SendDataPacketAction,
	SendAnalogValueAction,
	ReceiveMessageAction,
	ROOMID_SIMULATOR,
	ROOMID_FINDENTITY,
	ROOMID_EXTERNAL,
} from './simulationmessaging';

const UI_ENTIY_PATH = [ROOMID_EXTERNAL, "demo UI"];

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

function entityMessageDataPath(emd:EntityCommandData):string {
	return ""+emd[0];
}

function base64Encode(data:Uint8Array):string {
	// btoa is kinda goofy.
	const strs = new Array(data.length);
	for( let i=data.length-1; i>=0; --i ) strs[i] = String.fromCharCode(data[i]);
	return btoa(strs.join(""));
}

function newUuidRef():string { return uuidUrn(newType4Uuid()); }

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
	width : number;
	height: number;
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
	return {
		bitstr: bitStr,
		color0: modVals['color0']|0,
		color1: modVals['color1']|0,
		width : modVals['width'] |0 || defaultWidth,
		height: modVals['height']|0 || defaultHeight
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

interface MazeViewage {
	/**
	 * When in editor mode, this will be a copy
	 * of the RoomEntities aroound the camera.
	 * Otherwise this will be a visuals-only representation.
	 */
	visualEntities : RoomVisualEntity[];
	visibility? : ShadeRaster;
	opacity? : ShadeRaster; // Fer debuggin
	cameraLocation? : RoomLocation;
}

class EntityImageManager
{
	// Note that this all needs to be completely rewritten
	// in order to deal with non-bitimg: icons
	// and to take state, time, orientation into account
	
	public constructor( protected gameDataManager:GameDataManager ) { }
	
	protected urlishImageCache:KeyedList<string> = {};
	protected getUrlishImage( ref:string ):string {
		if( this.urlishImageCache[ref] ) return this.urlishImageCache[ref];
		
		const bitImgRee = oneBitImageDataRegex.exec(ref);
		let xRef = ref;
		if( bitImgRee ) {
			const bitImgInfo = parseBitImg(bitImgRee);
			xRef = parseOneBitImageDataToDataUrl( bitImgInfo.bitstr, bitImgInfo.width, bitImgInfo.height, bitImgInfo.color0, bitImgInfo.color1 );
		} else {
			throw new Error(ref+" not parse!");
		}
		
		return this.urlishImageCache[ref] = xRef;
	}
	
	protected iconCache:KeyedList<ImageSlice<HTMLImageElement>> = {};
	public getIconIfLoaded( visualRef:string, state:KeyedList<any>|undefined, time:number, orientation:Quaternion, preferredResolution:number, initiateFetch:boolean=false ):ImageSlice<HTMLImageElement>|undefined {
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
		
		const imgRef = this.getUrlishImage(visualRef);
		return this.iconPromises[visualRef] = this.fetchImage(imgRef).then( (img) => {
			return this.iconCache[visualRef] = {
				sheetRef: imgRef,
				sheet: img,
				origin: makeVector(img.width/2, img.height/2, 0),
				resolution: 16,
				bounds: makeAabb(0,0,0, img.width,img.height,0)
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
	
	protected _viewage : MazeViewage = { visualEntities: [] };
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
	
	public get viewage() { return this._viewage; }
	
	public set viewage(v:MazeViewage) {
		this._viewage = v;
		this.requestRedraw();
	}
	
	public canvasPixelToWorldCoordinates(x:number, y:number, dest?:Vector3D ):Vector3D {
		const pdx = x - this.screenCenterX, pdy = y - this.screenCenterY;
		const ppm = this.ppm;
		return setVector( dest, pdx/ppm, pdy/ppm, 0 );
	}
}

function roomToMazeViewage( roomRef:string, roomPosition:Vector3D, gdm:GameDataManager, viewage:MazeViewage, visibility:ShadeRaster, includeGreatInfo:boolean ):void {
	const room = gdm.getRoom(roomRef);
	if( room == null ) throw new Error("Failed to load room "+roomRef);
	
	let _entityToMazeViewage = ( entity:Entity, position:Vector3D, orientation:Quaternion  ) => {}
	_entityToMazeViewage = ( entity:Entity, position:Vector3D, orientation:Quaternion ) => {
		const entityClass = gdm.getEntityClass(entity.classRef);
		if( entityClass == null ) throw new Error("Failed to load entity class "+entity.classRef);
		if( entityClass.visualRef ) {
			const minVrX = Math.max(0                , Math.floor((position.x+entityClass.visualBoundingBox.minX+visibility.originX)*visibility.resolution));
			const minVrY = Math.max(0                , Math.floor((position.y+entityClass.visualBoundingBox.minY+visibility.originY)*visibility.resolution));
			const maxVrX = Math.min(visibility.width , Math.ceil( (position.x+entityClass.visualBoundingBox.maxX+visibility.originX)*visibility.resolution));
			const maxVrY = Math.min(visibility.height, Math.ceil( (position.y+entityClass.visualBoundingBox.maxY+visibility.originY)*visibility.resolution));
			//console.log("Visibility bounds: "+minVrX+","+minVrY+" - "+maxVrX+","+maxVrY);
			let visible = false;
			isVisibleLoop: for( let vry=minVrY; vry<maxVrY; ++vry ) for( let vrx=minVrX; vrx<maxVrX; ++vrx ) {
				//console.log("Check bisibility raster@"+vrx+","+vry+"; "+(visibility.width*vry+vrx)+" = "+visibility.data[visibility.width*vry+vrx]);
				if( visibility.data[visibility.width*vry+vrx] >= VISIBILITY_MIN ) {
					visible = true;
					break isVisibleLoop;
				}
			}
			
			// TODO: Re-use items, visuals
			if( visible ) viewage.visualEntities.push( {
				// TODO: Just send position normal,
				// visual should contain offsets
				position: {
					x: position.x + aabbAverageX(entityClass.visualBoundingBox),
					y: position.y + aabbAverageY(entityClass.visualBoundingBox),
					z: position.z + aabbAverageZ(entityClass.visualBoundingBox),
				},
				orientation: orientation,
				visualRef: entityClass.visualRef,
				entity: includeGreatInfo ? entity : undefined,
			})
		}
		eachSubEntity( entity, position, gdm, _entityToMazeViewage );
	};

	for( let re in room.roomEntities ) {
		const roomEntity = room.roomEntities[re];
		const orientation = roomEntity.orientation ? roomEntity.orientation : Quaternion.IDENTITY;
		_entityToMazeViewage( roomEntity.entity, addVector(roomPosition, roomEntity.position), orientation );
	}
}
function sceneToMazeViewage( roomRef:string, roomPosition:Vector3D, gdm:GameDataManager, viewage:MazeViewage, visibility:ShadeRaster, includeGreatInfo:boolean ):void {
	const room = gdm.getRoom(roomRef);
	if( room == null ) throw new Error("Failed to load room "+roomRef);
	roomToMazeViewage( roomRef, roomPosition, gdm, viewage, visibility, includeGreatInfo );
	for( let n in room.neighbors ) {
		const neighb = room.neighbors[n];
		roomToMazeViewage( neighb.roomRef, addVector(roomPosition, neighb.offset), gdm, viewage, visibility, includeGreatInfo );
	}
}

enum XYZDirection {
	NONE = 0x00,
	POSITIVE_X = 0x1,
	NEGATIVE_X = 0x2,
	POSITIVE_Y = 0x4,
	NEGATIVE_Y = 0x8,
	POSITIVE_X_POSITIVE_Y = 0x5,
	NEGATIVE_X_NEGATIVE_Y = 0xA,
	NEGATIVE_X_POSITIVE_Y = 0x6,
	POSITIVE_X_NEGATIVE_Y = 0x9,
	// Fill these in as needed
	POSITIVE_Z = 0x10,
	NEGATIVE_Z = 0x20,
};

const xyzDirectionVectors:KeyedList<Vector3D> = {};
{
	// encode component
	const ec = function(i:number):number {
		return i == 0 ? 0 : i > 0 ? 1 : 2;
	}
	
	for( let z=-1; z<=1; ++z ) {
		for( let y=-1; y<=1; ++y ) {
			for( let x=-1; x<=1; ++x ) {
				const xyzDirection = (ec(x)) | (ec(y)<<2) | (ec(z)<<4);
				xyzDirectionVectors[xyzDirection] = xyzDirection == 0 ? ZERO_VECTOR : makeVector(x,y,z);
			}
		}
	}
}
const sideDirections:XYZDirection[] = [
	XYZDirection.POSITIVE_X,
	XYZDirection.POSITIVE_Y,
	XYZDirection.POSITIVE_Z,
	XYZDirection.NEGATIVE_X,
	XYZDirection.NEGATIVE_Y,
	XYZDirection.NEGATIVE_Z,
];
const ALL_SIDES = 0x3F;

interface RoomEntityUpdate {
	roomRef? : string;
	position? : Vector3D;
	velocityPosition? : Vector3D;
}

/*
 * Return values:
 *   true = yes, include this!
 *   false = I do not care about this at all!
 *   undefined = I don't care about this specific thing, but I may care about things contained in it
 */
type EntityFilter = (roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass)=>boolean|undefined; 

interface FoundEntity {
	roomRef : string;
	roomEntityId : string;
	roomEntity : RoomEntity;
	
	// Individual entity that was collided-with
	entity : Entity;
	entityPosition : Vector3D;
	entityClass : EntityClass; // since we have it anyway!
}

type BounceBox = { [k:number]: FoundEntity|undefined }

const entityPositionBuffer:Vector3D = makeVector(0,0,0);
const rotate45Clockwise:TransformationMatrix3D        = deepFreeze(TransformationMatrix3D.fromXYZAxisAngle(0,0,1,+Math.PI/4));
const rotate45CounterClockwise:TransformationMatrix3D = deepFreeze(TransformationMatrix3D.fromXYZAxisAngle(0,0,1,-Math.PI/4));
const movementAttemptTransforms = [
	TransformationMatrix3D.IDENTITY,
	rotate45Clockwise,
	rotate45CounterClockwise
];

function entityVelocity( roomEntity:RoomEntity ):Vector3D {
	return roomEntity.velocity || ZERO_VECTOR;
}
function entityMass( entityClass:EntityClass ):number {
	return entityClass.mass == null ? Infinity : entityClass.mass;
}

function bounceFactor( ec0:EntityClass, ec1:EntityClass ):number {
	const bf0 = ec0.bounciness == null ? 0.5 : ec0.bounciness;
	const bf1 = ec1.bounciness == null ? 0.5 : ec1.bounciness;
	return bf0*bf1;
}

function oneify( val:number ):number {
	return val == 0 ? 0 : val > 0 ? 1 : -1;
}

function clampAbs( val:number, maxAbs:number ):number {
	if( val > maxAbs  ) return maxAbs;
	if( val < -maxAbs ) return -maxAbs;
	return val;
}

function directionate( dir:number, current:number ):number {
	if( dir > 0 && current > 0 ) return current;
	if( dir < 0 && current < 0 ) return current;
	return current;
}

function directionateVector( desired:Vector3D, current:Vector3D ):Vector3D {
	return {
		x: directionate(desired.x, current.x),
		y: directionate(desired.y, current.y),
		z: directionate(desired.z, current.z),
	}
}

/**
 * Calculate the impulse that entity A should exert onto entity B
 * in order to affect the desired change in B's relative velocity, dv.
 */
function dvImpulse(
	desiredDv:Vector3D, entityAMass:number|undefined, entityBMass:number|undefined,
	maxImpulseMagnitude:number, multiplier:number=1
):Vector3D {
	if( entityAMass == null ) entityAMass = Infinity;
	if( entityBMass == null ) entityBMass = Infinity;
	const minMass = Math.min(entityAMass, entityBMass);
	if( minMass == Infinity ) {
		// maximum impulse!
		return normalizeVector(desiredDv, maxImpulseMagnitude*multiplier);
	}
	const desiredImpulse = scaleVector(desiredDv, minMass);
	const desiredImpulseMagnitude = vectorLength(desiredImpulse);
	if( desiredImpulseMagnitude > maxImpulseMagnitude ) {
		multiplier *= maxImpulseMagnitude / desiredImpulseMagnitude;
	}
	return scaleVector(desiredImpulse, multiplier);
}

function impulseForAtLeastDesiredVelocity(
	desiredRelativeVelocity:Vector3D,
	currentRelativeVelocity:Vector3D,
	entityAMass:number|undefined, entityBMass:number|undefined,
	maxSpeed:number, maxImpulse:number,
	multiplier:number=1
):Vector3D {
	const targetRelativeVelocity = normalizeVector(desiredRelativeVelocity, maxSpeed);
	const targetDeltaVelocity = directionateVector(
		desiredRelativeVelocity,
		subtractVector(targetRelativeVelocity, currentRelativeVelocity)
	);
	return dvImpulse( targetDeltaVelocity, entityAMass, entityBMass, maxImpulse, multiplier );
}

interface Collision {
	roomAId : string;
	roomEntityA : RoomEntity;
	roomBId : string;
	roomEntityB : RoomEntity;
	velocity : Vector3D;
}

function perpendicularPart( vec:Vector3D, perpendicularTo:Vector3D ):Vector3D {
	const perpendicularLength = vectorLength(perpendicularTo);
	if( perpendicularLength == 0 ) return vec;
	return subtractVector(vec, scaleVector(perpendicularTo, dotProduct(vec,perpendicularTo)/perpendicularLength));
}

export class MazeGamePhysics {
	constructor( protected game:MazeSimulator ) { }
	
	public activeRoomIds:KeyedList<string> = {};
	public activatedRoomIds:KeyedList<string> = {};
	
	public induceVelocityChange( roomId:string, entityId:string, roomEntity:RoomEntity, dv:Vector3D ):void {
		if( vectorIsZero(dv) ) return; // Save ourselves a little bit of work
		roomEntity.velocity = addVector(entityVelocity(roomEntity), dv);
		this.activatedRoomIds[roomId] = roomId;
	}
	
	public registerReactionlessImpulse( roomId:string, entityId:string, roomEntity:RoomEntity, impulse:Vector3D ):void {
		const entityClass = this.game.gameDataManager.getEntityClass(roomEntity.entity.classRef);
		const mass = entityMass(entityClass);
		if( mass == Infinity ) return; // Nothing's going to happen
		this.induceVelocityChange(roomId, entityId, roomEntity, scaleVector(impulse, -1/mass));
	}
	
	public registerImpulse( eARoomId:string, entityAId:string, entityA:RoomEntity, eBRoomId:string, entityBId:string, entityB:RoomEntity, impulse:Vector3D ):void {
		if( vectorIsZero(impulse) ) return; // Save ourselves a little bit of work
		
		const eAClass = this.game.gameDataManager.getEntityClass(entityA.entity.classRef);
		const eBClass = this.game.gameDataManager.getEntityClass(entityB.entity.classRef);
		
		const eAMass = entityMass(eAClass);
		const eBMass = entityMass(eBClass);
		
		if( eAMass == Infinity && eBMass == Infinity ) return; // Nothing's going to happen
		
		const eAVel = entityVelocity(entityA);
		const eBVel = entityVelocity(entityB);
		
		let systemMass:number;
		let aRat:number, bRat:number;
		//let systemVelocity:Vector3D;
		if( eAMass == Infinity ) {
			systemMass = Infinity;
			aRat = 0; bRat = 1;
			//systemVelocity = eAVel;
		} else if( eBMass == Infinity ) {
			systemMass = Infinity;
			aRat = 1; bRat = 0;
			//systemVelocity = eBVel;
		} else {
			systemMass = eAMass + eBMass;
			aRat = (systemMass-eAMass)/systemMass;
			bRat = (systemMass-eBMass)/systemMass;
			//systemVelocity = addVector(scaleVector(eAVel, eAMass/systemMass), scaleVector(eBVel, eBMass/systemMass));
		}
		
		const relativeDv = scaleVector(impulse, 1/eBMass + 1/eAMass);
		//const eADv = scaleVector(impulse, -1/eAMass);
		
		if( aRat != 0 ) this.induceVelocityChange(eARoomId, entityAId, entityA, scaleVector(relativeDv, -aRat));
		if( bRat != 0 ) this.induceVelocityChange(eBRoomId, entityBId, entityB, scaleVector(relativeDv, +bRat));
	}
	
	public drainEnergy( entity:Entity, drain:number ):number {
		if( entity.storedEnergy == undefined ) return drain;
		//if( entity.storedEnergy == 0 ) return 0;
		drain = Math.min(entity.storedEnergy, drain);
		entity.storedEnergy -= drain;
		return drain;
	}
	
	public attemptInducedImpulse(
		eARoomId:string, entityAId:string, entityA:RoomEntity, eBRoomId:string, entityBId:string, entityB:RoomEntity, impulse:Vector3D
	):boolean {
		const requiredEnergy = vectorLength(impulse); // TODO: I don't think that's right.
		const availableEnergy = this.drainEnergy( entityA.entity, requiredEnergy );
		// TODO: Calculate actual impulse from available energy
		const adjustedImpulse = normalizeVector(impulse, availableEnergy);
		this.registerImpulse( eARoomId, entityAId, entityA, eBRoomId, entityBId, entityB, adjustedImpulse );
		return true;
	}	
	
	protected applyCollisions() {
		for( let collEntityAId in this.collisions ) {
			for( let collEntityBId in this.collisions[collEntityAId] ) {
				const collision:Collision = this.collisions[collEntityAId][collEntityBId];
				const eAClass = this.game.gameDataManager.getEntityClass(collision.roomEntityA.entity.classRef);
				const eBClass = this.game.gameDataManager.getEntityClass(collision.roomEntityB.entity.classRef);
				// TODO: Figure out collision physics better?
				const theBounceFactor = bounceFactor(eAClass, eBClass);
				const stopImpulse = scaleVector(collision.velocity, Math.min(entityMass(eAClass), entityMass(eBClass)));
				const bounceImpulse = scaleVector(stopImpulse, theBounceFactor);
				const eAVel = collision.roomEntityA.velocity || ZERO_VECTOR;
				const eBVel = collision.roomEntityB.velocity || ZERO_VECTOR;
				const eAPerpVel = perpendicularPart(eAVel, collision.velocity);
				const eBPerpVel = perpendicularPart(eBVel, collision.velocity);
				const frictionImpulse = normalizeVector(subtractVector(eAPerpVel,eBPerpVel),
					Math.max(eAClass.coefficientOfFriction || 0.25, eBClass.coefficientOfFriction || 0.25) *
					vectorLength(stopImpulse) *
					Math.max(0, 1-theBounceFactor)
				);
				const totalImpulse = {x:0,y:0,z:0};
				accumulateVector(stopImpulse, totalImpulse)
				accumulateVector(bounceImpulse, totalImpulse)
				accumulateVector(frictionImpulse, totalImpulse)
				this.registerImpulse(
					collision.roomAId, collEntityAId, collision.roomEntityA,
					collision.roomBId, collEntityBId, collision.roomEntityB,
					totalImpulse
				);
			}
		}
		this.collisions = {};
	}

	protected collisions:KeyedList<KeyedList<Collision>>;
	public registerCollision(
		roomAId:string, eAId:string, eA:RoomEntity,
		roomBId:string, eBId:string, eB:RoomEntity, velocity:Vector3D
	):void {
		if( eAId > eBId ) {
			return this.registerCollision( roomBId, eBId, eB, roomAId, eAId, eA, scaleVector(velocity, -1));
		}
		
		if( !this.collisions[eAId] ) this.collisions[eAId] = {};
		const already = this.collisions[eAId][eBId];
		
		if( already && vectorLength(already.velocity) > vectorLength(velocity) ) return;
		
		this.collisions[eAId][eBId] = {
			roomAId: roomAId,
			roomEntityA: eA,
			roomBId: roomBId,
			roomEntityB: eB,
			velocity: velocity
		}
	}
	
	protected borderingCuboid( roomRef:string, bb:AABB, dir:Vector3D, gridSize:number ):AABB {
		let minX = bb.minX, maxX = bb.maxX;
		let minY = bb.minY, maxY = bb.maxY;
		let minZ = bb.minZ, maxZ = bb.maxZ;
		if( dir.x < 0 ) {
			maxX = minX; minX -= gridSize; 
		} else if( dir.x > 0 ) {
			minX = maxX; maxX += gridSize;
		}
		if( dir.y < 0 ) {
			maxY = minY; minY -= gridSize; 
		} else if( dir.y > 0 ) {
			minY = maxY; maxY += gridSize;
		}
		if( dir.z < 0 ) {
			maxZ = minZ; minZ -= gridSize; 
		} else if( dir.z > 0 ) {
			minZ = maxZ; maxZ += gridSize;
		}
		return makeAabb( minX,minY,minZ, maxX,maxY,maxZ );
	}
	
	protected borderingEntities( roomRef:string, pos:Vector3D, bb:AABB, dir:Vector3D, gridSize:number, filter:EntityFilter ):FoundEntity[] {
		const border = this.borderingCuboid(roomRef, bb, dir, gridSize);
		return this.game.entitiesAt( roomRef, pos, border, filter );
	}
	
	protected massivestCollision( collisions:FoundEntity[] ):FoundEntity|undefined {
		let maxMass = 0;
		let massivest:FoundEntity|undefined = undefined;
		for( let c in collisions ) {
			const coll = collisions[c];
			const entityClass = this.game.gameDataManager.getEntityClass(coll.roomEntity.entity.classRef);
			const mass = entityMass(entityClass);
			if( mass > maxMass ) {
				maxMass = mass;
				massivest = coll;
			}
		}
		return massivest;
	}
	
	/**
	 * Finds the most massive (interactive, rigid) object in the space specified
	 */
	protected massivestBorderingEntity( roomRef:string, pos:Vector3D, bb:AABB, dir:Vector3D, gridSize:number, filter:EntityFilter ):FoundEntity|undefined {
		return this.massivestCollision( this.borderingEntities(roomRef, pos, bb, dir, gridSize, filter) );
	}
	
	protected neighboringEntities( roomRef:string, pos:Vector3D, bb:AABB, sideMask:number, gridSize:number, filter:EntityFilter ):KeyedList<FoundEntity[]> {
		const neighbors:KeyedList<FoundEntity[]> = {};
		for( let d in sideDirections ) {
			const xyzDir = sideDirections[d];
			if( ((+xyzDir)&sideMask) == 0 ) continue;
			const vec = xyzDirectionVectors[xyzDir];
			neighbors[xyzDir] = this.borderingEntities(roomRef, pos, bb, vec, gridSize, filter);
		}
		return neighbors;
	}

	/**
	 * What's around the entity?
	 */
	protected entityBounceBox( roomRef:string, pos:Vector3D, bb:AABB, sideMask:number, gridSize:number, filter:EntityFilter ):BounceBox {
		const bounceBox:BounceBox = {};
		for( let d in sideDirections ) {
			const xyzDir = sideDirections[d];
			if( ((+xyzDir)&sideMask) == 0 ) continue;
			const vec = xyzDirectionVectors[xyzDir];
			bounceBox[xyzDir] = this.massivestBorderingEntity(roomRef, pos, bb, vec, gridSize, filter);
		}
		return bounceBox;
	}
	
	protected snapGridSize = 1/8;
	
	public updateEntities(interval:number):void {
		const game = this.game;
		const gdm = game.gameDataManager;
		/** lesser object ID => greater object ID => force exerted from lesser to greater */
		const gravRef:string = "gravity";
		const gravDv = makeVector(0, 10*interval, 0);
		const rooms = game.activeRooms;
		const maxWalkForce = 450; // ~100 pounds of force?
		
		const entitiesToMove:{roomId:string, entityId:string, moveOrder:number}[] = [];
		const snapGridSize = this.snapGridSize;
		
		// Auto pickups!  And door opens.  And death.
		for( let r in this.activeRoomIds ) {
			let room = rooms[r];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				const entity = roomEntity.entity;
				const reVel = roomEntity.velocity||ZERO_VECTOR;
				
				if( entity.classRef == dat.playerEntityClassId && entity.storedEnergy < 1 ) {
					this.game.killRoomEntity(r, re);
				}
				
				if( !entity.desiresMaze1AutoActivation ) continue;
				const entityClass = gdm.getEntityClass(entity.classRef);
				
				const pickupFilter:EntityFilter =
					(roomEntityId:string, roomEntity:RoomEntity, entity:Entity, _entityClass:EntityClass) =>
						_entityClass.structureType != StructureType.INDIVIDUAL ? undefined :
						_entityClass.isMaze1AutoPickup || _entityClass.cheapMaze1DoorKeyClassRef != undefined;
				const eBb = entityClass.physicalBoundingBox;
				const pickupBb = makeAabb(
					eBb.minX-snapGridSize, eBb.minY-snapGridSize, eBb.minZ-snapGridSize,
					eBb.maxX+snapGridSize, eBb.maxY+snapGridSize, eBb.maxZ+snapGridSize
				)
				
				const foundIois = this.game.entitiesAt(r, roomEntity.position, pickupBb, pickupFilter);
				checkIois: for( let p in foundIois ) {
					const foundIoi = foundIois[p];
					if(
						foundIoi.roomRef == r &&
						dotProduct(
							subtractVector(foundIoi.entityPosition, roomEntity.position),
							subtractVector(foundIoi.roomEntity.velocity||ZERO_VECTOR,reVel),
						) > 0
					) {
						// If they're moving away from each other, forget it!
						continue checkIois;
					}
					if( foundIoi.entityClass.isMaze1AutoPickup ) {
						let pickedUp:boolean;
						if( foundIoi.entityClass.isMaze1Edible ) {
							entity.storedEnergy += +foundIoi.entityClass.maze1NutritionalValue;
							pickedUp = true;
						} else {
							const inventorySize = entityClass.maze1InventorySize;
							if( inventorySize == undefined ) continue checkIois;
							if( entity.maze1Inventory == undefined ) entity.maze1Inventory = {};
							let currentItemCount = 0;
							let leastImportantItemKey:string|undefined;
							let leastImportantItemImportance:number = Infinity;
							for( let k in entity.maze1Inventory ) {
								++currentItemCount;
								const itemClass = gdm.getEntityClass(entity.maze1Inventory[k].classRef);
								const itemImportance = itemClass.maze1Importance || 0;
								if( itemImportance < leastImportantItemImportance ) {
									leastImportantItemImportance = itemImportance;
									leastImportantItemKey = k;
								}
							}
							if( currentItemCount >= inventorySize ) {
								if( leastImportantItemKey == undefined ) {
									console.warn("Can't pick up new item; inventory full and nothing to drop!")
									continue checkIois;
								}
								const foundItemImportance = foundIoi.entityClass.maze1Importance || 0;
								if( foundItemImportance < leastImportantItemImportance ) {
									continue checkIois;
								}
								const throwDirection = vectorIsZero(reVel) ? {x:1,y:0,z:0} : normalizeVector(reVel, -1);
								const throwStart = addVector(roomEntity.position, normalizeVector(throwDirection, 0.5));
								try {
									this.game.placeItemSomewhereNear(entity.maze1Inventory[leastImportantItemKey], r, throwStart, throwDirection);
								} catch( err ) {
									console.log("Couldn't drop less important item:", err);
									continue checkIois;
								}
								delete entity.maze1Inventory[leastImportantItemKey];
							}
							entity.maze1Inventory[foundIoi.roomEntityId] = foundIoi.entity;
							pickedUp = true;
						}
						if( pickedUp ) {
							this.game.sendProximalEventMessageToNearbyEntities(r, roomEntity.position, 8, {
								classRef: "http://ns.nuke24.net/Game21/SimulationMessage/ItemPickedUp",
								itemClassRef: foundIoi.entity.classRef,
								pickerPath: [r, re],
							});
							delete rooms[foundIoi.roomRef].roomEntities[foundIoi.roomEntityId];
						}
					}
					doKey: if( foundIoi.entityClass.cheapMaze1DoorKeyClassRef ) {
						const requiredKeyClass = foundIoi.entityClass.cheapMaze1DoorKeyClassRef;
						const doorClass = foundIoi.entity.classRef;
						// Does player have one?
						if( entity.maze1Inventory ) {
							for( let k in entity.maze1Inventory ) {
								if( entity.maze1Inventory[k].classRef == requiredKeyClass ) {
									this.game.destroyCheapDoor( foundIoi.roomRef, foundIoi.entityPosition, doorClass );
									break doKey;
								}
							}
						}
					}
				}
			}
		}
		
		// Collect impulses
		// impulses from previous step are also included.
		for( let r in this.activeRoomIds ) {
			let room = rooms[r];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				const entity = roomEntity.entity;
				const entityClass = gdm.getEntityClass(entity.classRef);
				
				if( entityClass.mass == null || entityClass.mass == Infinity ) {
					// This thing ain't going anywhere
					if( entity.desiredMovementDirection == null ) {
						// Nor is it attempting to apply forces onto anyone else.
						// So we can skip doing anything with it at all.
						continue;
					}
				}
				
				// Room's got a possibly active entity in it,
				// so add to the active rooms list.
				this.activatedRoomIds[r] = r;
				// TODO: Don't activate room if entity is settled into an unmoving state
				// (would require activating neighbor rooms when things at edges change, etc)
				
				if( entityClass.isAffectedByGravity && entityClass.mass != null && entityClass.mass != Infinity ) {
					this.registerReactionlessImpulse(r, re, roomEntity, scaleVector(gravDv, -entityClass.mass));
					//this.induceVelocityChange(r, re, roomEntity, gravDv);
				}
				
				const otherEntityFilter:EntityFilter =
					(roomEntityId:string, roomEntity:RoomEntity, entity:Entity, _entityClass:EntityClass) =>
						roomEntityId != re;
				
				const neighbEnts = this.neighboringEntities(
					r, roomEntity.position, entityClass.physicalBoundingBox, ALL_SIDES, snapGridSize, otherEntityFilter );
				
				// TODO: Just use neighbEnts rather than querying again.
				const solidOtherEntityFilter:EntityFilter =
					(roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass) =>
						roomEntityId != re && entityClass.isSolid !== false;
				
				const floorCollision = this.massivestBorderingEntity(
					r, roomEntity.position, entityClass.physicalBoundingBox,
					xyzDirectionVectors[XYZDirection.POSITIVE_Y], snapGridSize, solidOtherEntityFilter);
				
				/*
				 * Possible forces:
				 * * Gravity pulls everything down
				 * - Entities may push directly off any surfaces (jump)
				 * - Entities may push sideways against surfaces that they are pressed against (e.g. floor)
				 * - Entities may climb along ladders or other climbable things
				 */
				
				const dmd = entity.desiredMovementDirection;
				let climbing = false;
				let walking = false;
				
				if( dmd != null && entityClass.climbingSkill && (floorCollision == null || dmd.y != 0) ) {
					const minClimbability = 1 - entityClass.climbingSkill;
					let mostClimbable:FoundEntity|undefined;
					let maxClimbability = 0;
					for( let dir in neighbEnts ) {
						const neighbEnts2 = neighbEnts[dir];
						for( let e in neighbEnts2 ) {
							const climbability = neighbEnts2[e].entityClass.climbability;
							if( climbability != null && climbability >= minClimbability && climbability >= maxClimbability ) {
								// Aw yih we can climb that!
								// Theoretically we would take direction of movement into account,
								// so if you wanted to go up you'd prefer a ladder that's itself moving that way.
								mostClimbable = neighbEnts2[e];
								maxClimbability = climbability;
							}
						}
					}
					if( mostClimbable ) {
						climbing = true;
						const maxClimbForce = entityClass.maxClimbForce || 0;
						const currentRv:Vector3D = subtractVector(entityVelocity(roomEntity), entityVelocity(mostClimbable.roomEntity));
						const maxClimbSpeed = entityClass.normalClimbingSpeed || entityClass.normalWalkingSpeed || 0;
						const climbImpulse = impulseForAtLeastDesiredVelocity(
							dmd, currentRv,
							entityClass.mass, gdm.getEntityClass(mostClimbable.roomEntity.entity.classRef).mass,
							maxClimbSpeed, interval*maxClimbForce, -1
						);
						this.attemptInducedImpulse(
							r, re, roomEntity, mostClimbable.roomRef,
							mostClimbable.roomEntityId, mostClimbable.roomEntity, climbImpulse);
					}
				}
				
				let onFloor = false;
				
				// TODO: Do this in a generic way for any 'walking' entities
				walk: if( floorCollision && entityVelocity(roomEntity).y - entityVelocity(floorCollision.roomEntity).y >= 0 ) {
					onFloor = true;
					
					if( dmd == null ) break walk;
					/** Actual velocity relative to surface */
					const dvx = entityVelocity(roomEntity).x - entityVelocity(floorCollision.roomEntity).x;
					/** Desired velocity relative to surface */
					const targetDvx = (entityClass.normalWalkingSpeed || 0) * oneify(dmd.x);
					/** Desired velocity change */
					const attemptDdvx = targetDvx - dvx;
					// Attempt to change to target velocity in single tick
					const walkForce = clampAbs( -attemptDdvx*entityClass.mass/interval, maxWalkForce );
					const walkImpulse = {x:walkForce*interval, y:0, z:0};
					this.attemptInducedImpulse(
						r, re, roomEntity,
						floorCollision.roomRef, floorCollision.roomEntityId, floorCollision.roomEntity,
						walkImpulse);
					
					if( dmd.y < 0 && entityClass.maxJumpImpulse ) {
						const jumpImpulse:Vector3D = {x:0, y:entityClass.maxJumpImpulse, z:0};
						if( this.attemptInducedImpulse(
							r, re, roomEntity,
							floorCollision.roomRef, floorCollision.roomEntityId, floorCollision.roomEntity, jumpImpulse)
						) {
							this.game.sendProximalEventMessageToNearbyEntities( r, roomEntity.position, 8, {
								classRef: "http://ns.nuke24.net/Game21/SimulationMessage/SimpleEventOccurred",
								eventCode: "jump",
							});
						}
					}
				} else {
					if( dmd && dmd.y < 0 && entityClass.maxJumpImpulse ) {
						//console.log(re+" can't jump; not on floor.", dmd.y);
					}
				}
				
				if( !climbing && !onFloor && dmd && entityClass.maxFlyingForce ) {
					this.registerReactionlessImpulse(
						r, re, roomEntity, scaleVector(dmd, -entityClass.maxFlyingForce*interval) );
				}
				
				if( roomEntity.velocity && !vectorIsZero(roomEntity.velocity) ) {
					const moveOrder = -dotProduct(roomEntity.position, roomEntity.velocity);
					entitiesToMove.push( {roomId: r, entityId: re, moveOrder} );
				}
			}
		}
		
		entitiesToMove.sort( (a,b):number => a.moveOrder - b.moveOrder );
		
		// Apply velocity to positions,
		// do collision detection to prevent overlap and collection collisions
		this.collisions = {};
		
		for( const etm in entitiesToMove ) {
			const entityToMove = entitiesToMove[etm];
			const room = rooms[entityToMove.roomId];
			const entityId = entityToMove.entityId;
			{
				const roomEntity = room.roomEntities[entityId];
				const velocity:Vector3D|undefined = roomEntity.velocity;
				if( velocity == null || vectorIsZero(velocity) ) continue;
				
				const entity = roomEntity.entity;
				const entityClass = gdm.getEntityClass(entity.classRef);
				const entityBb = entityClass.physicalBoundingBox;

				let entityRoomRef = entityToMove.roomId;
				
				let displacement = scaleVector( velocity, interval );

				const solidOtherEntityFilter:EntityFilter =
					(roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass) =>
						roomEntityId != entityId && entityClass.isSolid !== false;
				
				// Strategy here is:
				// figure [remaining] displacement based on velocity*interval
				// while remaining displacement > 0 {
				//   move along velocity vector as far as possible without collision
				//   based on objects in path of remaining displacement, apply impulses,
				//   calculate remaining displacement along surfaces
				// }
				
				let iter = 0;
				displacementStep: while( displacement && !vectorIsZero(displacement) ) {
					const maxDisplacementComponent =
						Math.max( Math.abs(displacement.x), Math.abs(displacement.y), Math.abs(displacement.z) );
					// How much of it can we do in a single step?
					const stepDisplacementRatio = Math.min(snapGridSize, maxDisplacementComponent) / maxDisplacementComponent;
					
					// Attempt displacing!
					const stepDeltaPos = scaleVector( displacement, stepDisplacementRatio ); 
					const newVelocityLocation = game.fixLocation({
						roomRef: entityRoomRef,
						position: addVector(
							roomEntity.velocityPosition || roomEntity.position,
							stepDeltaPos
						)
					});
					const newRoomRef = newVelocityLocation.roomRef;
					const newPosition = roundVectorToGrid(newVelocityLocation.position, snapGridSize);
					const collisions = game.entitiesAt(newVelocityLocation.roomRef, newPosition, entityBb, solidOtherEntityFilter);
					if( collisions.length == 0 ) {
						game.updateRoomEntity(entityRoomRef, entityId, {
							roomRef: newRoomRef,
							position: newPosition,
							velocityPosition: newVelocityLocation.position
						});
						this.activatedRoomIds[newRoomRef] = newRoomRef;
						entityRoomRef = newRoomRef;
						if( stepDisplacementRatio == 1 ) break displacementStep; // Shortcut; this should happen anyway
						// Subtract what we did and go again
						displacement = addVector(displacement, scaleVector(displacement, -stepDisplacementRatio));
						continue displacementStep;
					}
					
					// Uh oh, we've collided somehow.
					// Need to take that into account, zero out part or all of our displacement
					// based on where the obstacle was, register some impulses
					
					{
						// TODO: Only need bounce box for directions moving in
						const bounceBox:BounceBox = this.entityBounceBox(
							entityRoomRef, roomEntity.position, entityBb, ALL_SIDES, snapGridSize, solidOtherEntityFilter );
						
						let maxDvx = 0;
						let maxDvxColl:FoundEntity|undefined;
						let maxDvy = 0;
						let maxDvyColl:FoundEntity|undefined;
						
						let remainingDx = displacement.x;
						let remainingDy = displacement.y;

						// Is there a less repetetive way to write this?
						// Check up/down/left/right to find collisions.
						// If nothing found, then it must be a diagonal collision!
						// So then check diagonals.
						let coll:FoundEntity|undefined;
						if( displacement.x > 0 && (coll = bounceBox[XYZDirection.POSITIVE_X]) ) {
							remainingDx = 0;
							const collVel = entityVelocity(coll.roomEntity);
							const dvx = velocity.x - collVel.x;
							if( dvx > maxDvx ) {
								maxDvx = dvx;
								maxDvxColl = coll;
							}
						}
						if( displacement.x < 0 && (coll = bounceBox[XYZDirection.NEGATIVE_X]) ) {
							remainingDx = 0;
							const collVel = entityVelocity(coll.roomEntity);
							const dvx = velocity.x - collVel.x;
							if( dvx < maxDvx ) {
								maxDvx = dvx;
								maxDvxColl = coll;
							}
						}
						if( displacement.y > 0 && (coll = bounceBox[XYZDirection.POSITIVE_Y]) ) {
							remainingDy = 0;
							const collVel = entityVelocity(coll.roomEntity);
							const dvy = velocity.y - collVel.y;
							if( maxDvyColl == null || dvy > maxDvy ) {
								maxDvy = dvy;
								maxDvyColl = coll;
							}
						}
						if( displacement.y < 0 && (coll = bounceBox[XYZDirection.NEGATIVE_Y]) ) {
							remainingDy = 0;
							const collVel = entityVelocity(coll.roomEntity);
							const dvy = velocity.y - collVel.y;
							if( dvy < maxDvy ) {
								maxDvy = dvy;
								maxDvyColl = coll;
							}
						}
						
						if( maxDvxColl ) {
							this.registerCollision(
								newRoomRef, entityId, roomEntity,
								maxDvxColl.roomRef, maxDvxColl.roomEntityId, maxDvxColl.roomEntity, makeVector(maxDvx, 0, 0) 
							);
						}
						if( maxDvyColl ) {
							this.registerCollision(
								newRoomRef, entityId, roomEntity,
								maxDvyColl.roomRef, maxDvyColl.roomEntityId, maxDvyColl.roomEntity, makeVector(0, maxDvy, 0)
							);
						}
						
						// New displacement = displacement without the components that
						// would take us into obstacles:
						if( remainingDx != 0 && remainingDy != 0 ) {
							// A diagonal hit, probably.
							// Keep the larger velocity component
							if( Math.abs(remainingDx) < Math.abs(remainingDy) ) {
								remainingDx = 0;
							} else {
								remainingDy = 0;
							}
						}
						
						displacement = { x: remainingDx, y: remainingDy, z: 0 };
						
						++iter;
						if( iter > 2 ) {
							console.log("Too many displacement steps while moving "+entityId+":", roomEntity, "class:", entityClass, "iter:", iter, "velocity:", velocity, "displacement:", displacement, "bounceBox:", bounceBox, "max dvx coll:", maxDvxColl, "max dby coll:", maxDvyColl);
							break displacementStep;
						}
					}
				}
			}
		}
		
		this.applyCollisions();
	}
}

interface ExternalDevice {
	message( em:SimulationMessage, replyPath?:EntityPath ):void;
}

interface InternalSystemProgramEvaluationContext {
	entityPath : EntityPath,
	entity : Entity,
	system : MessageBusSystem,
	subsystemKey : string;
	variableValues : KeyedList<any>;
};

type ISPEC = InternalSystemProgramEvaluationContext;

function evalInternalSystemProgram( expression:esp.ProgramExpression, ctx:ISPEC ):any {
	switch( expression.classRef ) {
	case "http://ns.nuke24.net/TOGVM/Expressions/LiteralString":
	case "http://ns.nuke24.net/TOGVM/Expressions/LiteralNumber":
	case "http://ns.nuke24.net/TOGVM/Expressions/LiteralBoolean":
		return expression.literalValue;
	case "http://ns.nuke24.net/TOGVM/Expressions/ArrayConstruction":
		const argValues:any[] = [];
		for( let i=0; i<expression.values.length; ++i ) {
			argValues.push(evalInternalSystemProgram(expression.values[i], ctx));
		}
		return argValues;
	case "http://ns.nuke24.net/TOGVM/Expressions/Variable":
		return ctx.variableValues[expression.variableName];
	case "http://ns.nuke24.net/TOGVM/Expressions/FunctionApplication":
		{
			const argValues:any[] = [];
			for( let i=0; i<expression.arguments.length; ++i ) {
				argValues.push(evalInternalSystemProgram(expression.arguments[i], ctx));
			}
			if( !expression.functionRef ) throw new Error("Oh no dynamic functions not implemented boo");
			switch( expression.functionRef ) {
			case "http://ns.nuke24.net/InternalSystemFunctions/SendBusMessage":
				if( argValues.length == 1 ) { 
					const bm = argValues[0];
					if( !Array.isArray(bm) || bm.length < 1 || typeof bm[0] != 'string' ) {
						throw new Error("Entity message must be an array with string as first element");
					}
					if( !ctx.system.enqueuedBusMessages ) ctx.system.enqueuedBusMessages = [];
					ctx.system.enqueuedBusMessages.push( bm );
					return null;
				} else {
					throw new Error("SendBusMessage given non-1 arguments: "+JSON.stringify(argValues));
				}
			default:
				throw new Error("Call to unsupported function "+expression.functionRef);
			}
		}
	default:
		throw new Error(
			"Dunno how to evaluate expression classcamp town ladies sing this song, do da, do da, "+
			"camp town race track five miles long, oh da do da day: "+expression.classRef);
	}
}

// TODO: Rename to MazeGameSimulator,
// move active room management to GameDataManager.
export class MazeSimulator {
	protected rooms:KeyedList<Room> = {};
	protected activeRoomIds:KeyedList<string> = {};
	protected phys = new MazeGamePhysics(this);
	public logger:Logger = console;
	
	protected enqueuedActions:SimulationAction[] = [];
	
	protected externalDevices:KeyedList<ExternalDevice> = {};
	public registerExternalDevice( name:string, dev:ExternalDevice ):void {
		this.externalDevices[name] = dev;
	}
	
	public constructor( public gameDataManager:GameDataManager ) { }
	
	public enqueueAction( act:SimulationAction ):void {
		this.enqueuedActions.push(act);
	}
	
	public get activeRooms() { return this.rooms; }
	
	protected getMutableRoom( roomId:string ):Room {
		if( this.rooms[roomId] ) return this.rooms[roomId];
		return this.rooms[roomId] = this.gameDataManager.getMutableRoom(roomId);
	}
	
	public getRoom( roomId:string ):Room {
		if( this.rooms[roomId] ) return this.rooms[roomId];
		return this.gameDataManager.getRoom(roomId);
	}
	
	public fullyCacheRoom( roomId:string ):Promise<Room> {
		return this.gameDataManager.fullyCacheRoom(roomId);
	}
	
	public fullyLoadRoom( roomId:string ):Promise<Room> {
		return this.fullyCacheRoom(roomId).then( (room) => {
			return this.getMutableRoom(roomId);
		});
	}

	protected roomLoadPromises:KeyedList<Promise<Room>> = {};
	protected fullyLoadRooms2( rootRoomId:string ):Promise<Room> {
		if( this.roomLoadPromises[rootRoomId] ) return this.roomLoadPromises[rootRoomId];
		this.roomLoadPromises[rootRoomId] = this.fullyLoadRoom( rootRoomId );
		return this.roomLoadPromises[rootRoomId].then( (room) => {
			const lProms:Promise<Room>[] = [];
			for( let n in room.neighbors ) {
				const nRoomRef = room.neighbors[n].roomRef;
				if( !this.rooms[nRoomRef] && !this.roomLoadPromises[nRoomRef] ) {
					lProms.push(this.fullyLoadRooms2(nRoomRef));
				}
			}
			return Promise.all(lProms).then( () => room );
		});
	}
	
	public rootRoomId:string|undefined; // Most recently fullyLoadRooms ref.
	
	public fullyLoadRooms( rootRoomId:string ):Promise<KeyedList<Room>> {
		this.rootRoomId = rootRoomId;
		return this.fullyLoadRooms2(rootRoomId).then( () => {
			this.roomLoadPromises = {};
			return this.rooms;
		} );
	}
	
	public fixLocation(loc:RoomLocation):RoomLocation {
		let room = this.getMutableRoom(loc.roomRef);
		if( !aabbContainsVector(room.bounds, loc.position) ) for( let n in room.neighbors ) {
			const neighb = room.neighbors[n];
			const fixedPos = subtractVector(loc.position, neighb.offset);
			if( aabbContainsVector(neighb.bounds, fixedPos) ) {
				return {
					roomRef: neighb.roomRef,
					position: fixedPos,
				};
			}
		}
		return loc;
	}

	public updateRoomEntity( roomRef:string, entityId:string, update:RoomEntityUpdate ):void {
		let room : Room = this.getMutableRoom(roomRef);
		let roomEntity = room.roomEntities[entityId];
		if( update.position ) {
			roomEntity.position = update.position;
			delete roomEntity.velocityPosition;
		}
		if( update.velocityPosition ) roomEntity.velocityPosition = update.velocityPosition;
		if( update.roomRef != null && update.roomRef != roomRef ) {
			let newRoom : Room = this.getMutableRoom(update.roomRef);
			newRoom.roomEntities[entityId] = roomEntity;
			delete room.roomEntities[entityId];
		}
	}
	
	/**
	 * It should be safe to pass entityPositionBuffer as the entity position,
	 * since checking intersections is the last thing done with it.
	 */
	protected entitiesAt3(
		roomRef:string, roomEntityId:string, roomEntity:RoomEntity, // Root roomEntity
		entityPos:Vector3D, entity:Entity, // Individual entity being checked against (may be a sub-entity of the roomEntity)
		checkPos:Vector3D, checkBb:AABB, // Sample box
		filter:EntityFilter,
		into:FoundEntity[]
	):void {
		const proto = this.gameDataManager.getEntityClass( entity.classRef );
		const filtered = filter(roomEntityId, roomEntity, entity, proto)
		if( filtered === false ) return;
		if( !aabbIntersectsWithOffset(entityPos, proto.physicalBoundingBox, checkPos, checkBb) ) return;
		
		if( proto.structureType == StructureType.INDIVIDUAL ) {
			if( !filtered ) return;
			into.push( {
				roomRef: roomRef,
				roomEntityId: roomEntityId,
				roomEntity: roomEntity,
				entityPosition: {x:entityPos.x, y:entityPos.y, z:entityPos.z},
				entity: entity,
				entityClass: proto,
			} );
		}
		
		eachSubEntityIntersectingBb( entity, entityPos, checkPos, checkBb, this.gameDataManager, (subEnt, subEntPos, ori) => {
			this.entitiesAt3( roomRef, roomEntityId, roomEntity, subEntPos, subEnt, checkPos, checkBb, filter, into );
		}, this, entityPositionBuffer);
	}
	
	protected entitiesAt2( roomPos:Vector3D, roomRef:string, checkPos:Vector3D, checkBb:AABB, filter:EntityFilter, into:FoundEntity[] ):void {
		// Room bounds have presumably already been determined to intersect
		// with that of the box being checked, so we'll skip that and go
		// straight to checking entities.
		const room:Room = this.getRoom(roomRef);
		for( let re in room.roomEntities ) {
			const roomEntity = room.roomEntities[re];
			addVector( roomPos, roomEntity.position, entityPositionBuffer );
			this.entitiesAt3(roomRef, re, roomEntity, entityPositionBuffer, roomEntity.entity, checkPos, checkBb, filter, into)
		}
	}
	
	/** Overly simplistic 'is there anything at this exact point' check */
	public entitiesAt( roomRef:string, pos:Vector3D, bb:AABB, filter:EntityFilter ):FoundEntity[] {
		const collisions:FoundEntity[] = [];
		const room = this.getRoom(roomRef);
		if( aabbIntersectsWithOffset(ZERO_VECTOR, room.bounds, pos, bb) ) {
			this.entitiesAt2( ZERO_VECTOR, roomRef, pos, bb, filter, collisions );
		}
		for( let n in room.neighbors ) {
			const neighb = room.neighbors[n];
			// I used to check that bb overlapped neighb.bounds.
			// That results in missing collisions with entities whose physical bounds
			// go beyond that of the room they're in, duh.	
			this.entitiesAt2( neighb.offset, neighb.roomRef, pos, bb, filter, collisions );
		}
		return collisions;
	}
	
	protected setTileTreeBlock( roomId:string, pos:Vector3D, tileScale:number, newTile:TileEntity|number|string|null ):void {
		const room = this.getMutableRoom(roomId);
		for( let re in room.roomEntities ) {
			const roomEntity = room.roomEntities[re];
			const entityClass = this.gameDataManager.getEntityClass(roomEntity.entity.classRef);
			if( entityClass.structureType == StructureType.TILE_TREE ) {
				const posWithinTt = subtractVector(pos, roomEntity.position);
				if( aabbContainsVector(entityClass.tilingBoundingBox, posWithinTt) ) {
					// TODO: Make sure this works for trees with depth > 1
					roomEntity.entity.classRef = rewriteTileTree(
						roomEntity.position, roomEntity.entity.classRef,
						(ckPos:Vector3D, ckAabb:AABB, currentTileIndex:number, currentTileEntity:TileEntity|null|undefined) => {
							if( offsetAabbContainsVector(ckPos, ckAabb, pos) && aabbWidth(ckAabb) == tileScale ) {
								return newTile;
							} else {
								return currentTileIndex;
							}
						}, this.gameDataManager
					);
				}
			}
		}
	}
	
	/** @temporary-shortcut */
	public destroyCheapDoor( roomId:string, pos:Vector3D, doorEntityClass:string ) {
		// destroy all nearby doorEntityClass tiles in the same root tiletree
		const aabbOfDestruction = makeAabb(pos.x-0.5, pos.y-2.5, pos.z-0.5, pos.x+0.5, pos.y+2.5, pos.z+0.5);
		const room = this.getMutableRoom(roomId);
		for( let re in room.roomEntities ) {
			const roomEntity = room.roomEntities[re];
			const entityClass = this.gameDataManager.getEntityClass(roomEntity.entity.classRef);
			if( entityClass.structureType == StructureType.TILE_TREE ) {
				const posWithinTt = subtractVector(pos, roomEntity.position);
				if( aabbContainsVector(entityClass.tilingBoundingBox, posWithinTt) ) {
					roomEntity.entity.classRef = rewriteTileTree(
						roomEntity.position, roomEntity.entity.classRef,
						(ckPos:Vector3D, ckAabb:AABB, currentTileIndex:number, currentTileEntity:TileEntity|null|undefined) => {
							if(
								aabbIntersectsWithOffset(ckPos, ckAabb, ZERO_VECTOR, aabbOfDestruction) &&
								currentTileEntity && currentTileEntity.entity.classRef == doorEntityClass
							) {
								return null;
							} else {
								return currentTileIndex;
							}
						}, this.gameDataManager
					);
				}
			}
		}
		// TODO: This should send an event to nearby entities that can hear it
		// with relativePosition filled in.
		this.sendProximalEventMessageToNearbyEntities(roomId, pos, 8, {
			classRef: "http://ns.nuke24.net/Game21/SimulationMessage/SimpleEventOccurred",
			eventCode: 'door-opened'
		});
	}
	
	protected processEntityMessage(
		roomId:string, room:Room, entityId:string,
		roomEntity:RoomEntity, md:SimulationMessage
	):void {
		switch( md.classRef ) {
		case "http://ns.nuke24.net/Game21/SimulationMessage/CommandReceived":
			return this.processEntityCommand(roomId, room, entityId, roomEntity, md.command);
		}
	}
	
	protected processEntityCommand(
		roomId:string, room:Room, entityId:string,
		roomEntity:RoomEntity, md:EntityCommandData
	):void {	
		const path = entityMessageDataPath(md);
		if( path == "/desiredmovementdirection" ) {
			roomEntity.entity.desiredMovementDirection = makeVector(+md[1],+md[2],+md[3]);
			// Make sure the room is marked as active:
			this.activeRoomIds[roomId] = roomId;
		} else if( path == "/painttiletreeblock" ) {
			const relX = +md[1];
			const relY = +md[2];
			const relZ = +md[3];
			const tileScale = +md[4] || 1;
			const block = md[5];
			if( typeof block != 'string' && typeof block != 'number' && block !== null ) {
				console.log("Erps; bad block");
				return;
			}
			if( typeof block == 'string' ) {
				if( this.gameDataManager.getObjectIfLoaded<EntityClass>( block ) == null ) {
					console.log("Entity class "+block+" not loaded.  Try again later.");
					// Try to load it up and ignore this request for now.
					// User can click again. :P
					this.gameDataManager.fetchObject<EntityClass>( block ).then( (entiyClass) => {
						console.log("Entity class "+block+" loaded, now!  You should be able to place it, now.");
					}).catch( (err) => {
						console.error("Failed to load entity class "+block);
					});
					return;
				}
			}
			const rePos = roomEntity.position;
			const blockLoc = this.fixLocation( {roomRef: roomId, position: makeVector(relX+rePos.x, relY+rePos.y, relZ+rePos.z)} );
			this.setTileTreeBlock( blockLoc.roomRef, blockLoc.position, tileScale, block );
			return;
		} else if( path == '/give' ) {
			// put a thing in your inventory, if there's space
			const itemClassRef = md[1];
			if( itemClassRef == undefined ) return;
			try {
				const itemClass = this.gameDataManager.getEntityClass(itemClassRef, true);
			} catch (err) {
				console.error("Couldn't give item", err);
				return;
			}
			const entityClass = this.gameDataManager.getEntityClass(roomEntity.entity.classRef);
			const inventorySize = entityClass.maze1InventorySize || 0;
			if( inventorySize == 0 ) {
				console.warn("Can't add item; inventory size = 0");
				return;
			}
			let currentItemCount = 0;
			if( roomEntity.entity.maze1Inventory == undefined ) roomEntity.entity.maze1Inventory = {};
			for( let k in roomEntity.entity.maze1Inventory ) ++currentItemCount;
			if( currentItemCount < inventorySize ) {
				roomEntity.entity.maze1Inventory[newUuidRef()] = {
					classRef: itemClassRef
				};
			} else {
				console.warn("Can't add item; inventory full");
			}
		} else if( path == '/vomit' ) {
			if( roomEntity.entity.storedEnergy != undefined ) {
				roomEntity.entity.storedEnergy /= 2;
				chunks: for( let i=0; i<20; ++i ) {
					let vel = roomEntity.velocity||ZERO_VECTOR;
					if( vectorIsZero(vel) ) vel = {x:0,y:-1,z:0};
					vel = addVector(vel, normalizeVector(vel, 5));
					vel = {x:vel.x+Math.random()-0.5, y:vel.y+Math.random()-0.5, z:vel.z};
					vel = normalizeVector(vel, 4 + Math.random()*0.25 - 0.125);
					const offset = normalizeVector(vel, 0.5);
					const chunk = {classRef: pickOne([dat.vomitChunk1EntityClassId, dat.vomitChunk2EntityClassId, dat.vomitChunk3EntityClassId])};
					try {
						this.placeItemSomewhereNear(chunk, roomId, addVector(roomEntity.position, offset), vel);
					} catch (err) { break chunks; }
				}
			}
		} else if( path == '/throwinventoryitem' ) {
			if( md[1] == undefined ) {
				console.error("missing item key argument to /throwinventoryitem");
				return;
			}
			const itemRef = md[1];
			if( roomEntity.entity.maze1Inventory == undefined ) {
				console.warn("No inventory at all; can't throw item'");
				return;
			}
			const item = roomEntity.entity.maze1Inventory[itemRef];
			if( item == undefined ) {
				console.warn("No item "+itemRef+" seems to exist in inventory:", roomEntity.entity.maze1Inventory);
				return;
			}
			const throwOffset = normalizeVector({x:+md[2], y:+md[3], z:+md[4]}, 0.5);
			try {
				this.placeItemSomewhereNear(item, roomId, addVector(roomEntity.position,throwOffset), scaleVector(throwOffset,10));
			} catch( err ) {
				console.log("Couldn't throw:", err)
				return;
			}
			delete roomEntity.entity.maze1Inventory[itemRef];
		}
	}
	
	protected processSimulatorMessage(msg:SimulationMessage):void {
		switch( msg.classRef ) {
		case "http://ns.nuke24.net/Game21/SimulationMessage/CommandReceived":
			return this.processSimulatorCommand(msg.command);
		}
	}
	
	protected processSimulatorCommand(messageData:EntityCommandData):void {
		switch( messageData[0] ) {
		case '/create-room':
			{
				const roomId = messageData[1];
				if( typeof roomId != 'string' ) {
					this.logger.error("'create-room' argument not a string", messageData);
					return;
				}
				const size = +(messageData[2] || 16);
				const ttId = newUuidRef();
				this.gameDataManager.putMutableObject<Room>(roomId, {
					bounds: makeAabb(-size/2,-size/2,-8, size/2,size/2,8),
					neighbors: {},
					roomEntities: {
						[ttId]: {
							position: ZERO_VECTOR,
							entity: {
								classRef: dat.getDefaultRoomTileTreeRef(this.gameDataManager, size, size, 1)
							}
						}
					}
				});
				this.logger.log("Created room "+roomId);
			}
			break;
		case '/connect-rooms':
			{
				const room1Id = messageData[1];
				const dir = ""+messageData[2];
				const room2Id = messageData[3];
				// For now all rooms are 16x16, so
				let nx = 0, ny = 0, nz = 0;
				for( let i=0; i<dir.length; ++i ) {
					switch( dir[i] ) {
					case 't': ny = -1; break;
					case 'b': ny = +1; break;
					case 'l': nx = -1; break;
					case 'r': nx = +1; break;
					case 'a': nz = -1; break;
					case 'z': nz = +1; break;
					default:
						this.logger.warn("Unrecognized direction char: "+dir[i]);
					}
				}
				try {
					const room1 = this.gameDataManager.getRoom(room1Id);
					const room2 = this.gameDataManager.getRoom(room2Id);
					const dx =
						nx > 0 ? room1.bounds.maxX-room2.bounds.minX :
						nx < 0 ? room1.bounds.minX-room2.bounds.maxX : 0;
					const dy =
						ny > 0 ? room1.bounds.maxY-room2.bounds.minY :
						ny < 0 ? room1.bounds.minY-room2.bounds.maxY : 0;
					const dz =
						nz > 0 ? room1.bounds.maxZ-room2.bounds.minZ :
						nz < 0 ? room1.bounds.minZ-room2.bounds.maxZ : 0;
					const nVec = makeVector(dx, dy, dz);
					this.logger.log("Connecting "+room1Id+" to "+room2Id+" @ "+vectorToString(nVec));
					connectRooms(this.gameDataManager, room1Id, room2Id, nVec);
				} catch( err ) {
					this.logger.error("Failed to connect rooms", err);
				}
			}
			break;
		default:
			this.logger.warn("Unrecognized simulator message:", messageData);
		}
	}
	
	protected get hasPendingMessageUpdates():boolean {
		return this.enqueuedActions.length > 0;
	}
	
	protected findEntity(entityId:string):string|undefined{
		for( let roomId in this.rooms ) {
			const room = this.rooms[roomId];
			if( room.roomEntities[entityId] ) return roomId;
		}
		return undefined;
	}
	
	public getRoomEntity(entityId:string):RoomEntity|undefined {
		for( let roomId in this.rooms ) {
			const room = this.rooms[roomId];
			if( room.roomEntities[entityId] ) return room.roomEntities[entityId];
		}
		return undefined;
	}
	
	public enqueueMessage( targetPath:EntityPath, message:SimulationMessage, replyPath?:EntityPath ) {
		if( targetPath[0] == ROOMID_EXTERNAL ) {
			this.deliverExternalDeviceMessage(targetPath, message, replyPath);
		}
		
		this.enqueueAction({
			classRef: "http://ns.nuke24.net/Game21/SimulationAction/ReceiveMessage",
			entityPath: targetPath,
			message,
			replyPath,
		})
	}
	
	protected runSubsystemProgram(
		entityPath:EntityPath, entity:Entity, subsystemKey:string, program:esp.ProgramExpression,
		variableValues:KeyedList<any>
	):any {
		const ctx:ISPEC = {
			entityPath, entity, system:entity, subsystemKey, variableValues
		};
		return evalInternalSystemProgram( program, ctx );
	}
	
	protected handleSubsystemMessage( entityPath:EntityPath, system:Entity, subsystemKey:string, subsystem:EntitySubsystem, message:EntitySystemBusMessage ) {
		console.log("message to the "+subsystemKey, message);
		// TODO!!!
		switch( subsystem.classRef ) {
			
		}
	}
	
	protected handleSystemMessage(
		entityPath:EntityPath, system:Entity, message:EntitySystemBusMessage
	):void {
		if( message.length < 1 ) {
			console.warn("Zero length system bus message", message);
			return;
		}
		const path = ""+message[0];
		const ppre = /^\/([^\/]+)(\/.*|)$/;
		const pprem = ppre.exec(path);
		if( pprem == null ) {
			console.warn("Bad message path syntax: '"+path+"'");
			return;
		}
		
		const subsystemKey = pprem[1];
		if( !system.internalSystems[subsystemKey] ) {
			// This might turn out to be a semi-normal occurrence,
			// in which case I should stop cluttering the log with it.
			console.warn("Message to nonexistent subsystem '"+pprem[1]+"'", message);
			return;
		}
		const subsystem = system.internalSystems[subsystemKey];
		const subsystemMessage = [pprem[2], ...message.slice(1)];
		this.handleSubsystemMessage(entityPath, system, subsystemKey, subsystem, subsystemMessage);
	}
	
	protected updateInternalSystem(
		entityPath:EntityPath, system:Entity
	):void {
		for( let i=0; i<system.enqueuedBusMessages.length; ++i ) {
			this.handleSystemMessage(entityPath, system, system.enqueuedBusMessages[i]);
		}
		system.enqueuedBusMessages = []; 
	}
	
	public sendProximalEventMessageToNearbyEntities(
		roomId:string, pos:Vector3D, maxDistance:number,
		message:ProximalSimulationMessage
	) {
		const proximalEventDetectingEntityFilter:EntityFilter = (
			roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass
		):boolean => {
			const detectorSystem = getEntitySubsystem(entity, ESSKEY_PROXIMALEVENTDETECTOR, this.gameDataManager);
			if( detectorSystem == undefined ) return false;
			switch( detectorSystem.classRef ) {
			case "http://ns.nuke24.net/Game21/EntitySubsystem/ProximalEventDetector":
				if( detectorSystem.onEventExpressionRef ) return true;
			}
			return false;
		}
		
		// Ha ha for now just forward to UI.
		// TODO: Look for entities with ProximalEventDetectors,
		// pass this message to them.
		// The player's should be set up to forward to /controlleruplink,
		// Which should be translated to a message to the UI.
		const foundEntities = this.entitiesAt(roomId, pos, makeAabb(
			-maxDistance,-maxDistance,-maxDistance,
			+maxDistance,+maxDistance,+maxDistance
		), proximalEventDetectingEntityFilter );
		
		for( let fe in foundEntities ) {
			const foundEntity = foundEntities[fe];
			const iSys = getEntitySubsystem(foundEntity.entity, ESSKEY_PROXIMALEVENTDETECTOR, this.gameDataManager);
			if( !iSys ) continue;
			switch( iSys.classRef ) {
			case "http://ns.nuke24.net/Game21/EntitySubsystem/ProximalEventDetector":
				if( iSys.onEventExpressionRef ) {
					const expr = this.gameDataManager.getObject<esp.ProgramExpression>(iSys.onEventExpressionRef);
					this.runSubsystemProgram(
						[foundEntity.roomRef, foundEntity.roomEntityId], foundEntity.entity,
						ESSKEY_PROXIMALEVENTDETECTOR, expr,
						{
							event: message 
						}
					);
					this.updateInternalSystem([foundEntity.roomRef, foundEntity.roomEntityId], foundEntity.entity);
				}
			}
		}
		
		/*
		const dev = this.externalDevices['ui'];
		if( !dev ) return;
		dev.message( message );
		*/
	}
	
	protected deliverExternalDeviceMessage( targetPath:EntityPath, message:SimulationMessage, replyPath?:EntityPath ) {
		const deviceId = targetPath[1];
		if( this.externalDevices[deviceId] ) {
			this.externalDevices[deviceId].message( message, replyPath );
		}
	}
	
	protected doReceiveMessageAction( act:ReceiveMessageAction ):void {
		let roomId:string|undefined;
		
		switch( act.entityPath[0] ) {
		case ROOMID_SIMULATOR:
			this.processSimulatorMessage(act.message);
			return;
		case ROOMID_FINDENTITY:
			roomId = this.findEntity(act.entityPath[1]);
			if( roomId == null ) {
				console.warn("Can't deliver entity message: failed to find room containing entity "+act.entityPath[1]);
				return;
			}
			break;
		case ROOMID_EXTERNAL:
			this.deliverExternalDeviceMessage(act.entityPath, act.message, act.replyPath);
			return;
		default:
			roomId = act.entityPath[0];
		}
		if( act.entityPath.length != 2 ) {
			console.error("Can't deliver entity message: unsupported path length: "+act.entityPath.length);
			return;
		}
		const room = this.rooms[roomId];
		if( !room ) {
			console.warn("Can't deliver entity message: no such room: '"+roomId+"'");
			return;
		}
		const roomEntityKey = act.entityPath[1];
		const roomEntity = room.roomEntities[roomEntityKey];
		if( roomEntity == null ) {
			console.warn("Can't deliver entity message: entity "+roomEntityKey+" not found in room "+roomId);
			return;
		}
		// TODO: May need to handle more path... 
		this.processEntityMessage(roomId, room, roomEntityKey, roomEntity, act.message);
	}
	
	protected doAction( act:SimulationAction ):void {
		switch( act.classRef ) {
		case "http://ns.nuke24.net/Game21/SimulationAction/ReceiveMessage":
			this.doReceiveMessageAction(act);
			break;
		default:
			console.error("Unrecognized action class: "+act.classRef);
		}

	}
	
	protected doMessageUpdate() {
		const handlingActions = this.enqueuedActions;
		this.enqueuedActions = [];
		for( let ac in handlingActions ) {
			const act:SimulationAction = handlingActions[ac];
			this.doAction(act);
		}
	}
	
	protected messageUpdateLength:number = 1/8192;
	
	protected doMessageUpdates(interval:number) {
		let count = Math.floor(interval/this.messageUpdateLength);
		for( let i=0; i<count && this.hasPendingMessageUpdates; ++i ) {
			this.doMessageUpdate();
		}
	}
	
	public findEmptySpaceNear(bb:AABB, roomId:string, position:Vector3D):RoomLocation {
		let distance = 0;
		const filter:EntityFilter = (roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass) => {
			if( entityClass.structureType == StructureType.INDIVIDUAL ) {
				return entityClass.isSolid !== false;
			}
			return undefined;
		};
		for( let attempts=0; attempts<16; ++attempts ) {
			const placePos = {
				x:position.x + (Math.random()*2-1)*distance,
				y:position.y + (Math.random()*2-1)*distance,
				z:position.z
			};
			if( this.entitiesAt(roomId, placePos, bb, filter).length == 0 ) {
				return this.fixLocation({
					roomRef: roomId,
					position: placePos
				})
			}
			distance += 1/16;
		}
		throw new Error("Failed to find empty space!");
	}
	
	public placeItemSomewhereNear(entity:Entity, roomId:string, position:Vector3D, velocity:Vector3D=ZERO_VECTOR) {
		const entityClass = this.gameDataManager.getEntityClass(entity.classRef);
		const physBb = entityClass.physicalBoundingBox;
		if( entityClass.structureType != StructureType.INDIVIDUAL ) {
			throw new Error('placeItemSomewhereNear not meant to handle '+entityClass.structureType+'-structure-typed things');
		}
		const loc = this.findEmptySpaceNear(physBb, roomId, position);
		const room = this.activeRooms[loc.roomRef];
		room.roomEntities[entity.id || newUuidRef()] = {
			position: loc.position,
			velocity: velocity,
			entity: entity
		}
	}
	
	public killRoomEntity(roomRef:string, entityRef:string) {
		const room = this.activeRooms[roomRef];
		const roomEntity = room.roomEntities[entityRef];
		if( roomEntity == undefined ) {
			console.warn("Can't kill entity "+roomRef+"/"+entityRef+" because that room entity's not found");
			return;
		}
		const entity = roomEntity.entity;
		if( entity.maze1Inventory ) for( let i in entity.maze1Inventory ) {
			try {
				this.placeItemSomewhereNear(entity.maze1Inventory[i], roomRef, roomEntity.position);
			} catch( err ) {
				console.warn("Uh oh, inventory item "+i+" was lost!");
			}
		}
		entity.maze1Inventory = {};
		entity.classRef = dat.deadPlayerEntityClassId;
		delete entity.desiredMovementDirection;
		delete entity.desiresMaze1AutoActivation; // Otherwise skeleton will steal your dropped keys! 
	}
	
	public update(interval:number=1/16) {
		this.doMessageUpdates(interval/2);
		
		this.phys.activeRoomIds = this.activeRoomIds;
		this.phys.activatedRoomIds = {};
		this.phys.updateEntities(interval);
		this.activeRoomIds = this.phys.activatedRoomIds;
		
		this.doMessageUpdates(interval/2);
	}
	
	public flushUpdates():Promise<string> {
		return this.gameDataManager.flushUpdates();
	}
	
	public locateRoomEntity( id:string ):FoundEntity|undefined {
		for( let r in this.rooms ) {
			const room = this.rooms[r];
			for( let re in room.roomEntities ) {
				if( re == id ) {
					const roomEntity = room.roomEntities[re];
					const entity = roomEntity.entity;
					const entityClass = this.gameDataManager.getEntityClass(entity.classRef);
					return {
						roomRef: r,
						roomEntityId: id,
						roomEntity,
						entityPosition: roomEntity.position,
						entity,
						entityClass
					};
				}
			}
		}
		return undefined;
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

const shortToLongFunctionRefs:KeyedList<esp.FunctionRef> = {
	"sendBusMessage": "http://ns.nuke24.net/InternalSystemFunctions/SendBusMessage",
};

function sExpressionToProgramExpression(x:any, gdm:GameDataManager):esp.ProgramExpression {
	if( typeof x == 'string' ) {
		return <esp.LiteralString>{
			classRef: "http://ns.nuke24.net/TOGVM/Expressions/LiteralString",
			literalValue: x
		};
	} else if( typeof x == 'number' ) {
		return <esp.LiteralNumber>{
			classRef: "http://ns.nuke24.net/TOGVM/Expressions/LiteralNumber",
			literalValue: x
		};
	} else if( typeof x == 'boolean' ) {
		return <esp.LiteralBoolean>{
			classRef: "http://ns.nuke24.net/TOGVM/Expressions/LiteralBoolean",
			literalValue: x
		};
	} else if( Array.isArray(x) ) {
		if( x.length == 0 ) throw new Error("S-expression is zero length, which is bad!"); // Unless I decide it means Nil.
		switch( x[0] ) {
		case 'makeArray':
			{
				const componentExpressions:esp.ProgramExpression[] = [];
				for( let i=1; i<x.length; ++i ) {
					componentExpressions.push( sExpressionToProgramExpression(x[i], gdm) );
				}
				return <esp.ArrayConstructionExpression>{
					classRef: "http://ns.nuke24.net/TOGVM/Expressions/ArrayConstruction",
					values: componentExpressions
				}
			}
		case 'var':
			{
				if( x.length != 2 ) throw new Error("Var expression requires exactly one argument; gave: "+JSON.stringify(x));
				if( typeof x[1] != 'string' ) {
					throw new Error("Oh no var name must be a literal string, not "+JSON.stringify(x[1]));
				}
				return <esp.VariableExpression>{
					classRef: "http://ns.nuke24.net/TOGVM/Expressions/Variable",
					variableName: x[1],
				}
			}
		}
		
		if( shortToLongFunctionRefs[x[0]] ) {
			const argumentExpressions:esp.ProgramExpression[] = [];
			for( let i=1; i<x.length; ++i ) {
				argumentExpressions.push( sExpressionToProgramExpression(x[i], gdm) );
			}
			return <esp.FunctionApplication>{
				classRef: "http://ns.nuke24.net/TOGVM/Expressions/FunctionApplication",
				functionRef: shortToLongFunctionRefs[x[0]],
				arguments: argumentExpressions
			};
		}
	}
	
	throw new Error("I can't compile this :( "+JSON.stringify(x));
}

function sExpressionToProgramExpressionRef(x:any[], gdm:GameDataManager):string {
	return gdm.tempStoreObject<esp.ProgramExpression>(
		sExpressionToProgramExpression(x, gdm)
	);
}

export class MazeDemo {
	public datastore : Datastore<Uint8Array>;
	public memoryDatastore : MemoryDatastore<Uint8Array>;
	public exportDatastore : MemoryDatastore<Uint8Array>;
	public gameDataManager : GameDataManager;
	public simulator : MazeSimulator;
	public canvas:HTMLCanvasElement;
	public soundPlayer:SoundPlayer;
	public view : MazeView;
	public playerId : string;
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
	protected foundTriforceThisLevel:boolean = false;
	public logger:Logger;
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
	public stopSimulation() {
		if( this.tickTimerId != undefined ) {
			clearInterval(this.tickTimerId);
			this.tickTimerId = undefined;
		}
	}
	
	protected tick() {
		this.simulator.update(this.tickRate);
		this.updateView();
	}

	public updateView() {
		// TODO: Have player entity send messages to the UI
		// instead of mucking around in game state
		this.maybePaint();
		const newViewage:MazeViewage = { visualEntities: [] };
		
		const foundPlayer = this.simulator.locateRoomEntity(this.playerId);
		const playerLoc = foundPlayer ? { roomRef: foundPlayer.roomRef, position: foundPlayer.entityPosition } : undefined;
		
		if( playerLoc ) {
			const rasterWidth = 41;
			const rasterHeight = 31;
			const rasterResolution = 2;
			const distance = 21;
			// Line up raster origin so it falls as close as possible to the center of the raster
			// while lining up edges with world coordinates
			// TODO: shouldn't need to snap to integer world coords; raster coords would be fine.
			const rasterOriginX = Math.floor(rasterWidth /rasterResolution/2) + playerLoc.position.x - Math.floor(playerLoc.position.x);
			const rasterOriginY = Math.floor(rasterHeight/rasterResolution/2) + playerLoc.position.y - Math.floor(playerLoc.position.y);
			const visibilityRaster   = new ShadeRaster(rasterWidth, rasterHeight, rasterResolution, rasterOriginX, rasterOriginY);
			let opacityRaster:ShadeRaster|undefined;
			const seeAll = this._demoMode == DemoMode.EDIT;

			const visibilityDistanceInRasterPixels = rasterResolution*distance;
			opacityRaster = new ShadeRaster(rasterWidth, rasterHeight, rasterResolution, rasterOriginX, rasterOriginY);
			const sceneShader = new SceneShader(this.simulator.gameDataManager);
			sceneShader.sceneOpacityRaster(playerLoc.roomRef, scaleVector(playerLoc.position, -1), opacityRaster);
			if( isAllZero(opacityRaster.data) ) console.log("Opacity raster is all zero!");
			if( isAllNonZero(opacityRaster.data) ) console.log("Opacity raster is all nonzero!");
			if( seeAll ) {
				sceneShader.initializeVisibilityRaster(opacityRaster, visibilityRaster, VISIBILITY_MIN);
			} else {
				sceneShader.initializeVisibilityRaster(opacityRaster, visibilityRaster);
				// Player eyes (TODO: configure on entity class):
				sceneShader.opacityTolVisibilityRaster(opacityRaster, (rasterOriginX-1/4)*rasterResolution, rasterOriginY*rasterResolution, visibilityDistanceInRasterPixels, visibilityRaster);
				sceneShader.opacityTolVisibilityRaster(opacityRaster, (rasterOriginX+1/4)*rasterResolution, rasterOriginY*rasterResolution, visibilityDistanceInRasterPixels, visibilityRaster);
				sceneShader.growVisibility(visibilityRaster);
			}
			sceneToMazeViewage( playerLoc.roomRef, scaleVector(playerLoc.position, -1), this.simulator.gameDataManager, newViewage, visibilityRaster, seeAll );
			if( seeAll ) newViewage.cameraLocation = playerLoc;

			newViewage.visibility = visibilityRaster;
			newViewage.opacity = opacityRaster;
		} else {
			console.log("Failed to locate player, "+this.playerId);
		}
		
		{
			const invItems:PaletteItem[] = [];
			if( foundPlayer ) {
				const inv = foundPlayer.entity.maze1Inventory || {};
				for( let k in inv ) {
					invItems.push({key: k, orientation: Quaternion.IDENTITY, entity: inv[k]});
					if( inv[k].classRef == dat.triforceEntityClassId && !this.foundTriforceThisLevel ) {
						// omg a triforce
						++this.foundTriforceCount;
						this.popUpWinDialog("You have found "+this.foundTriforceCount+" triforces!");
						this.foundTriforceThisLevel = true;
					}
				}
				if( this.energyIndicator ) this.energyIndicator.value = foundPlayer.entity.storedEnergy;
				if( foundPlayer.entity.storedEnergy < 1 && this.restartDialog && !this.restartDialog.isVisible ) {
					this.logger.log("You have run out of energy and died. :(");
					this.restartDialog.message = "You have run out of energy and died.";
					this.restartDialog.isVisible = true;
				} 
			} else {
				if( this.energyIndicator ) this.energyIndicator.value = undefined;
			}
			this.maze1InventoryUi.setAllSlots(invItems);
		}
		
		const locationDiv = document.getElementById('camera-location-box');
		if( locationDiv ) {
			let locationNode = locationDiv.firstChild;
			if( locationNode == null ) locationDiv.appendChild(locationNode = document.createTextNode(""));
			const cameraLoc = newViewage.cameraLocation;
			if( cameraLoc ) {
				const p = cameraLoc.position;
				locationNode.nodeValue = cameraLoc.roomRef+" @ "+p.x.toFixed(3)+","+p.y.toFixed(3)+","+p.z.toFixed(3);
			} else {
				locationNode.nodeValue = "";
			}
		}
		
		this.view.viewage = newViewage;
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
			this.enqueueCommand([ROOMID_FINDENTITY, this.playerId], ["/desiredmovementdirection", moveX, moveY, 0]);
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
		return this.simulator.flushUpdates().then( (gameDataRef) => {
			const rrf = this.simulator.rootRoomId;
			if( rrf == null ) return Promise.reject(new Error("Can't save; no root room specified!"));
			const saveGame:SaveGame = {
				gameDataRef: gameDataRef,
				rootRoomId: rrf,
				playerId: this.playerId
			};
			return storeObject<SaveGame>(saveGame, this.datastore);
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
		if( f == undefined ) return;
		this.soundPlayer.playSoundByRef(f.dataRef, f.volume);
	}
	
	protected handleSimulationMessage( msg:SimulationMessage ) {
		console.log("Message from simulation!", msg);
		if( !this.soundEffectsEnabled ) return;
		switch( msg.classRef ) {
		case "http://ns.nuke24.net/Game21/SimulationMessage/SimpleEventOccurred":
			this.playSound( this.simpleEventSounds[msg.eventCode] );
			break;
		case "http://ns.nuke24.net/Game21/SimulationMessage/ItemPickedUp":
			this.playSound( this.itemSounds[msg.itemClassRef] );
			break;
		}
	}
	
	public loadGame2(gdm:GameDataManager, playerId:string, rootRoomId:string, gameDescription:string):Promise<MazeSimulator> {
		this.stopSimulation();
		this.logLoadingStatus("Loading "+gameDescription+"...");
		this.context = {
			gameDataManager: gdm,
			entityImageManager: new EntityImageManager(gdm)
		};
		this.gameDataManager = gdm;
		this.simulator = new MazeSimulator(gdm);
		
		const thisDev:ExternalDevice = {
			message: this.handleSimulationMessage.bind(this)
		}
		//this.simulator.registerExternalDevice( this.deviceId, thisDev );
		this.simulator.registerExternalDevice( 'ui', thisDev );
		
		const loadPromise = gdm.cacheObjects([
			dat.basicTileEntityPaletteRef // A thing whose ID tends to be hard coded around
		]).then(	() =>
			this.simulator.fullyLoadRooms( rootRoomId )
		).then( () => {
			this.playerId = playerId;
			this.fixPlayer();
			this.updateView();
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
		return fetchObject(saveRef, this.datastore, true).then( (save:SaveGame) => {
			if( !save.gameDataRef ) return Promise.reject(new Error("Oh no, save data all messed up? "+JSON.stringify(save)));
			const gdm = new GameDataManager(this.datastore, save.gameDataRef);
			return this.loadGame2(gdm, save.playerId, save.rootRoomId, saveRef );
		}, (err) => {
			this.logLoadingStatus("Error loading save "+saveRef+"!", true, err);
		});
	}
	
	protected addControllerUplink( entity:Entity ) {
		setEntitySubsystem( entity, "controlleruplink", {
			classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/InterEntityBusBridge",
			forwardTo: [ROOMID_EXTERNAL, this.deviceId],
		}, this.gameDataManager );
	}
	
	protected fixPlayer():void {
		const playerRoomEntity = this.simulator.getRoomEntity(this.playerId);
		if( playerRoomEntity ) {
			this.addControllerUplink(playerRoomEntity.entity);
		} else {
			console.warn("Couldn't find player entity "+this.playerId+"; restarting level");
			this.restartLevel();
		}
	}
	
	public loadGame(saveGameRef:string):Promise<MazeSimulator> {
		const levelRe = /^level(\d+)$/;
		let levelReMatch:RegExpExecArray|null;
		const tempGdm = new GameDataManager(this.datastore);
		
		if( saveGameRef == 'demo' ) {
			return dat.initData(tempGdm).then( () => this.loadGame2( tempGdm, dat.playerEntityId, dat.room1Id, "demo maze" ))
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
	
	public restartLevel():void {
		const newPlayerId = this.playerId = newUuidRef();
		let playerPlaced = false;
		for( let r in this.simulator.activeRooms ) {
			const room = this.simulator.activeRooms[r];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				if( !playerPlaced && roomEntity.entity.classRef == dat.spawnPointEntityClassId ) {
					const playerEntity = {
						id: newPlayerId,
						classRef: dat.playerEntityClassId,
						desiresMaze1AutoActivation: true,
						storedEnergy: 100000,
						internalSystems: {
							[ESSKEY_PROXIMALEVENTDETECTOR]: <ProximalEventDetector>{
								classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/ProximalEventDetector",
								onEventExpressionRef: sExpressionToProgramExpressionRef(
									['sendBusMessage', ['makeArray', '/controlleruplink/proximalevent', ['var', 'event']]],
									this.gameDataManager
								)
							}
						}
					};
					this.addControllerUplink(playerEntity);
					this.simulator.placeItemSomewhereNear( playerEntity, r, roomEntity.position );
					playerPlaced = true;
				}
				if( re != newPlayerId && roomEntity.entity.classRef == dat.playerEntityClassId ) {
					this.simulator.killRoomEntity(r, re);
				}
			}
		}
		if( this.restartDialog ) this.restartDialog.isVisible = false;
		if( !playerPlaced ) {
			this.logLoadingStatus("No spawn point found!", true);
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
				return this.loadGame2( gdm, playerId, startRoomRef, "generated maze" ).then( () => {
					this.restartLevel();
				});
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
	
	public inspect(ref:string):Promise<any> {
		return this.simulator.gameDataManager.fetchObject(ref);
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
			this.enqueueCommand(
				[ROOMID_FINDENTITY, this.playerId],
				["/painttiletreeblock", coords.x, coords.y, coords.z, 1, this.paintEntityClassRef]
			);
		}
	}
	
	protected mouse1PreviouslyDown:boolean = true;
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
					const itemKey = this.maze1InventoryUi.selectedItemKey;
					if( itemKey ) this.enqueueCommand(
						[ROOMID_FINDENTITY, this.playerId],
						["/throwinventoryitem", this.maze1InventoryUi.selectedItemKey, coords.x, coords.y, coords.z]
					);
				}
				break;
			}
			this.mouse1PreviouslyDown = true;
		} else {
			this.paintCoordinates = undefined;
			this.mouse1PreviouslyDown = false;
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
	
	public enqueueCommand(entityPath:EntityPath, command:EntityCommandData, replyPath:EntityPath=UI_ENTIY_PATH):void {
		this.simulator.enqueueAction({
			classRef: "http://ns.nuke24.net/Game21/SimulationAction/ReceiveMessage",
			entityPath: entityPath,
			replyPath: replyPath,
			message: {
				classRef: "http://ns.nuke24.net/Game21/SimulationMessage/CommandReceived",
				command: command
			}
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
						this.enqueueCommand([ROOMID_SIMULATOR], ["/create-room", newRoomUuid, size]);
					}
					break;
				case 'connect-new-room': case 'dig-new-room': case 'dnr':
					{
						const currentLocation = this.view.viewage.cameraLocation;
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
						this.enqueueCommand([ROOMID_SIMULATOR], ["/create-room", newRoomUuid, this.defaultNewRoomSize]);
						this.enqueueCommand([ROOMID_SIMULATOR], ["/connect-rooms", currentLocation.roomRef, dir, newRoomUuid]);
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
						this.enqueueCommand([ROOMID_SIMULATOR], ["/connect-rooms", roomAId, dirName, roomBId]);
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
					this.enqueueCommand([ROOMID_FINDENTITY, this.playerId], ["/vomit"]);
					break;
				case 'give':
					if( tokens.length == 2 ) {
						this.enqueueCommand([ROOMID_FINDENTITY, this.playerId], ["/give", tokens[1].text]);
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
			eachSubEntity(entity, position, this.gameDataManager, (subEnt, subPos, subOri) => {
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
			const entityRenderer = new TileEntityRenderer(demo.simulator.gameDataManager);
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
			demo.enqueueCommand(
				[ROOMID_FINDENTITY, targetEntityIdBox.value],
				["/desiredmovementdirection", 0, -1, 0]
			);
		}
		
		const closeDoorButton = document.createElement('button');
		closeDoorButton.appendChild(document.createTextNode("Down"));
		closeDoorButton.onclick = () => {
			demo.enqueueCommand(
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
