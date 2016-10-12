import { sha1Urn, utf8Encode, utf8Decode } from '../tshash/index';
import Datastore from './Datastore';
import HTTPHashDatastore from './HTTPHashDatastore';
import MemoryDatastore from './MemoryDatastore';
import CachingDatastore from './CachingDatastore';
import BrowserStorageDatastore from './BrowserStorageDatastore';
import MultiDatastore from './MultiDatastore';

import { deepFreeze, thaw, deepThaw, isDeepFrozen } from './DeepFreezer';
import GameDataManager from './GameDataManager';
import { fetchObject, storeObject, fastStoreObject, encodeObject } from './JSONObjectDatastore';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import KeyedList from './KeyedList';
import Vector3D from './Vector3D';
import { makeVector, setVector, vectorToString, ZERO_VECTOR } from './vector3ds';
import { addVector, subtractVector, vectorLength, vectorIsZero, scaleVector, normalizeVector, dotProduct, roundVectorToGrid } from './vector3dmath';
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
import { makeTileTreeRef, makeTileEntityPaletteRef, eachSubEntity, eachSubEntityIntersectingBb, connectRooms } from './worldutil';
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
	TileEntityPalette
} from './world';
import ImageSlice from './ImageSlice';
import { EMPTY_IMAGE_SLICE, imageFromUrl } from './images';
import { rewriteTileTree } from './tiletrees';

import Tokenizer from './forth/Tokenizer';
import Token, { TokenType } from './forth/Token';

import Logger from './Logger';
import MultiLogger from './MultiLogger';
import DOMLogger from './ui/DOMLogger';
import TilePaletteUI from './ui/TilePalette';
import {
	StorageCompartmentContentUI
} from './ui/inventory';

import { EntityMessageData } from './simulationmessaging';

function entityMessageDataPath(emd:EntityMessageData):string {
	return ""+emd[0];
}

function base64Encode(data:Uint8Array):string {
	// btoa is kinda goofy.
	const strs = new Array(data.length);
	for( let i=data.length-1; i>=0; --i ) strs[i] = String.fromCharCode(data[i]);
	return btoa(strs.join(""));
}

interface EntityMessage {
	sourceId : string;
	destinationId : string;
	payload : EntityMessageData;
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
		const viewItems = this._viewage.visualEntities;
		for( let i in viewItems ) {
			const vi = viewItems[i];
			const te = vi.entity;
			const gdm = this._gameDataManager;
			if( te && gdm ) {
				const ec = gdm.getObjectIfLoaded<EntityClass>(te.classRef);
				if( ec && ec.tilingBoundingBox.maxX-ec.tilingBoundingBox.minX == tileSize && offsetAabbContainsVector(vi.position, ec.tilingBoundingBox, coords) ) {
					return {
						orientation: vi.orientation || Quaternion.IDENTITY,
						entity: te
					}
				}
				
			}
		}
		return undefined;
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

type EntityFilter = (roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass)=>boolean; 

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

export class MazeGamePhysics {
	constructor( protected game:MazeGame ) { }
	
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

	protected applyCollisions() {
		for( let collEntityAId in this.collisions ) {
			for( let collEntityBId in this.collisions[collEntityAId] ) {
				const collision:Collision = this.collisions[collEntityAId][collEntityBId];
				const eAClass = this.game.gameDataManager.getEntityClass(collision.roomEntityA.entity.classRef);
				const eBClass = this.game.gameDataManager.getEntityClass(collision.roomEntityB.entity.classRef);
				// TODO: Figure out collision physics better?
				const impulse = scaleVector(collision.velocity, Math.min(entityMass(eAClass), entityMass(eBClass))*(1+bounceFactor(eAClass, eBClass)));
				this.registerImpulse(
					collision.roomAId, collEntityAId, collision.roomEntityA,
					collision.roomBId, collEntityBId, collision.roomEntityB,
					impulse
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
	
	public updateEntities(interval:number):void {
		const game = this.game;
		const gdm = game.gameDataManager;
		/** lesser object ID => greater object ID => force exerted from lesser to greater */
		const gravRef:string = "gravity";
		const gravDv = makeVector(0, 10*interval, 0);
		const rooms = game.activeRooms;
		const maxWalkForce = 450; // ~100 pounds of force?
		
		const snapGridSize = 1/8;
		
		const entitiesToMove:{roomId:string, entityId:string, moveOrder:number}[] = [];
		
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
						this.registerImpulse(
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
					this.registerImpulse(
						r, re, roomEntity,
						floorCollision.roomRef, floorCollision.roomEntityId, floorCollision.roomEntity,
						walkImpulse);
					
					if( dmd.y < 0 && entityClass.maxJumpImpulse ) {
						const jumpImpulse:Vector3D = {x:0, y:entityClass.maxJumpImpulse, z:0};
						this.registerImpulse(
							r, re, roomEntity,
							floorCollision.roomRef, floorCollision.roomEntityId, floorCollision.roomEntity, jumpImpulse);
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

// TODO: Rename to MazeGameSimulator,
// move active room management to GameDataManager.
export class MazeGame {
	protected rooms:KeyedList<Room> = {};
	protected activeRoomIds:KeyedList<string> = {};
	protected phys = new MazeGamePhysics(this);
	public logger:Logger = console;
	
	protected entityMessages:KeyedList<EntityMessage[]> = {};

	public constructor( public gameDataManager:GameDataManager ) { }
	
	public enqueueEntityMessage( em:EntityMessage ):void {
		if( !this.entityMessages[em.destinationId] ) {
			this.entityMessages[em.destinationId] = [];
		}
		this.entityMessages[em.destinationId].push(em);
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

	public fullyLoadRooms( rootRoomId:string ):Promise<KeyedList<Room>> {
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
		if( !filter(roomEntityId, roomEntity, entity, proto) ) return;
		if( !aabbIntersectsWithOffset(entityPos, proto.physicalBoundingBox, checkPos, checkBb) ) return;
		
		if( proto.structureType == StructureType.INDIVIDUAL ) {
			into.push( {
				roomRef: roomRef,
				roomEntityId: roomEntityId,
				roomEntity: roomEntity,
				entityPosition: {x:entityPos.x, y:entityPos.y, z:entityPos.z},
				entity: entity,
				entityClass: proto,
			} );
		} else {
			eachSubEntityIntersectingBb( entity, entityPos, checkPos, checkBb, this.gameDataManager, (subEnt, subEntPos, ori) => {
				this.entitiesAt3( roomRef, roomEntityId, roomEntity, subEntPos, subEnt, checkPos, checkBb, filter, into );
			}, this, entityPositionBuffer);
		};
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
					roomEntity.entity.classRef = rewriteTileTree(
						roomEntity.position, roomEntity.entity.classRef,
						(ckPos:Vector3D, ckAabb:AABB, currentTileIndex:number, currentTileEntity:TileEntity|null|undefined) => {
							if( aabbContainsVector(ckAabb, pos) && aabbWidth(ckAabb) == tileScale ) {
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
	
	protected processEntityMessage(
		roomId:string, room:Room, entityId:string,
		roomEntity:RoomEntity, em:EntityMessage
	):void {
		const md = em.payload;
		const path = entityMessageDataPath(md);
		if( path == "/desiredmovementdirection" ) {
			roomEntity.entity.desiredMovementDirection = makeVector(+md[1],+md[2],+md[3]);
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
		}
	}
	
	protected handleMessage(message:EntityMessage):void {
		switch( message.payload[0] ) {
		case '/create-room':
			{
				const roomId = message.payload[1];
				if( typeof roomId != 'string' ) {
					this.logger.error("'create-room' argument not a string", message.payload);
					return;
				}
				const ttId = newUuidRef();
				this.gameDataManager.putMutableObject<Room>(roomId, {
					bounds: makeAabb(-8,-8,-8, 8,8,8),
					neighbors: {},
					roomEntities: {
						[ttId]: {
							position: ZERO_VECTOR,
							entity: {
								classRef: dat.getDefaultRoomTileTreeRef(this.gameDataManager)
							}
						}
					}
				});
				this.logger.log("Created room "+roomId);
			}
			break;
		case '/connect-rooms':
			{
				const room1Id = message.payload[1];
				const dir = ""+message.payload[2];
				const room2Id = message.payload[3];
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
					connectRooms(this.gameDataManager, room1Id, room2Id, makeVector(nx*16, ny*16, nz*16));
				} catch( err ) {
					this.logger.error("Failed to connect rooms", err);
				}
			}
			break;
		default:
			this.logger.warn("Unrecognized simulator message from "+message.sourceId+":", message.payload);
		}
	}
	
	protected get hasPendingMessageUpdates():boolean {
		for( let m in this.entityMessages ) return true;
		return false;
	}
	
	protected doMessageUpdate() {
		const simulatorMessages = this.entityMessages[simulatorId];
		if( simulatorMessages ) {
			for( let m in simulatorMessages ) {
				this.handleMessage(simulatorMessages[m]);
			}
		}
		
		for( let r in this.rooms ) {
			let room = this.rooms[r];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				if( this.entityMessages[re] ) {
					const msgs = this.entityMessages[re];
					for( let m in msgs ) this.processEntityMessage( r, room, re, roomEntity, msgs[m] );
					this.activeRoomIds[r] = r;
				}
			}
		}
		this.entityMessages = {};
	}
	
	protected messageUpdateLength:number = 1/8192;
	
	protected doMessageUpdates(interval:number) {
		let count = Math.floor(interval/this.messageUpdateLength);
		for( let i=0; i<count && this.hasPendingMessageUpdates; ++i ) {
			this.doMessageUpdate();
		}
	}
	
	public update(interval:number=1/16) {
		this.doMessageUpdates(interval/2);
		
		this.phys.activeRoomIds = this.activeRoomIds;
		this.phys.activatedRoomIds = {};
		this.phys.updateEntities(interval);
		this.activeRoomIds = this.phys.activatedRoomIds;
		
		this.doMessageUpdates(interval/2);
	}
	
	public flushUpdates():Promise<String> {
		return this.gameDataManager.flushUpdates();
	}
	
	public locateRoomEntity( id:string ):RoomLocation|undefined {
		for( let r in this.rooms ) {
			const room = this.rooms[r];
			for( let re in room.roomEntities ) {
				if( re == id ) {
					return {
						roomRef: r,
						position: room.roomEntities[re].position
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

interface ConsoleDialogBox extends DialogBox {
	inputElement:HTMLInputElement;
}

interface GameContext {
	gameDataManager : GameDataManager;
	entityImageManager : EntityImageManager;
}

type GameContextListener = (ctx:GameContext)=>void;

export class MazeDemo {
	public datastore : Datastore<Uint8Array>;
	public memoryDatastore : MemoryDatastore<Uint8Array>;
	public exportDatastore : MemoryDatastore<Uint8Array>;
	public game : MazeGame;
	public canvas:HTMLCanvasElement;
	public view : MazeView;
	public playerId : string;
	protected tickTimerId? : number;
	protected tickRate = 1/32;
	protected mode:DemoMode = DemoMode.PLAY;
	public tilePaletteUi:TilePaletteUI;
	public consoleDialog:ConsoleDialogBox;
	public logger:Logger;
	public loadingStatusUpdated:(text:string)=>any = (t)=>{};
	
	protected contextListeners:GameContextListener[] = [];
	public addContextListener(l:GameContextListener) {
		this.contextListeners.push(l);
	}
	
	protected set context(ctx:GameContext) {
		if( this.game ) this.game.gameDataManager = ctx.gameDataManager;
		if( this.view ) this.view.gameDataManager = ctx.gameDataManager;
		for( let l in this.contextListeners ) {
			this.contextListeners[l]( ctx );
		}
	}
	
	public switchToNextMode() {
		this.mode++;
		if( this.mode > 1 ) {
			this.mode = 0;
		}
		if( this.mode == DemoMode.EDIT ) {
			this.tilePaletteUi.element.style.display = "";
		} else {
			this.tilePaletteUi.element.style.display = "none";
		}
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
		this.game.update(this.tickRate);
		this.updateView();
	}

	public updateView() {
		this.maybePaint();
		const newViewage:MazeViewage = { visualEntities: [] };
		
		const playerLoc = this.game.locateRoomEntity(this.playerId);

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
			const seeAll = this.mode == DemoMode.EDIT;

			const visibilityDistanceInRasterPixels = rasterResolution*distance;
			opacityRaster = new ShadeRaster(rasterWidth, rasterHeight, rasterResolution, rasterOriginX, rasterOriginY);
			const sceneShader = new SceneShader(this.game.gameDataManager);
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
			sceneToMazeViewage( playerLoc.roomRef, scaleVector(playerLoc.position, -1), this.game.gameDataManager, newViewage, visibilityRaster, seeAll );
			if( seeAll ) newViewage.cameraLocation = playerLoc;

			newViewage.visibility = visibilityRaster;
			newViewage.opacity = opacityRaster;
		} else {
			console.log("Failed to locate player, "+this.playerId);
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
	
	protected keysDown:KeyedList<boolean> = {};
	protected keysUpdated() {
		let up=false,down=false,left=false,right=false;
		
		const rightKeys = [33,34,39,68];
		const leftKeys  = [35,36,37,65];
		const upKeys    = [33,36,38,87];
		const downKeys  = [34,35,40,83];
		
		for( let k in rightKeys ) if( this.keysDown[rightKeys[k]] ) right = true;
		for( let k in leftKeys  ) if( this.keysDown[leftKeys[k]]  ) left  = true;
		for( let k in upKeys    ) if( this.keysDown[upKeys[k]]    ) up    = true;
		for( let k in downKeys  ) if( this.keysDown[downKeys[k]]  ) down  = true;
		
		if( left && right ) left = right = false;
		if( up && down ) up = down = false;
		
		let moveX = right ? +1 : left ? -1 : 0;
		let moveY = down  ? +1 : up   ? -1 : 0;
		
		if( this.game && this.playerId ) {
			this.game.enqueueEntityMessage({sourceId: "ui", destinationId: this.playerId, payload:["/desiredmovementdirection", moveX, moveY, 0]});
		}
	}
	public keyDown(keyEvent:KeyboardEvent):void {
		if( keyEvent.keyCode == 9 ) {
			this.switchToNextMode();
			keyEvent.preventDefault();
			return;
		}
		if( keyEvent.keyCode == 191 ) {
			this.popUpConsole("/");
			keyEvent.preventDefault();
			return;
		}
		if( keyEvent.keyCode == 192 ) {
			this.popUpConsole("");
			keyEvent.preventDefault();
			return;
		}
		this.keysDown[keyEvent.keyCode] = true;
		this.keysUpdated();
	}
	public keyUp(keyEvent:KeyboardEvent):void {
		delete this.keysDown[keyEvent.keyCode];
		this.keysUpdated();
	}
	public saveGame():Promise<string> {
		return this.game.flushUpdates().then( (gameDataRef) => {
			const saveGame = {
				gameDataRef: gameDataRef,
				rootRoomId: dat.room1Id,
				playerId: this.playerId
			};
			return storeObject(saveGame, this.datastore);
		});
	}
	public loadGame(saveRef:string):Promise<MazeGame> {
		this.stopSimulation();
		this.loadingStatusUpdated("Loading game "+saveRef+"...");
		const loadPromise = fetchObject(saveRef, this.datastore, true).then( (save:SaveGame) => {
			if( !save.gameDataRef ) return Promise.reject(new Error("Oh no, save data all messed up? "+JSON.stringify(save)));
			const gdm = new GameDataManager(this.datastore, save.gameDataRef);
			this.context = {
				gameDataManager: gdm,
				entityImageManager: new EntityImageManager(gdm)
			}
			this.game = new MazeGame(gdm);
			console.log("Loading save "+saveRef+"...", save);
			return this.game.fullyLoadRooms( save.rootRoomId ).then( () => save );
		}).then( (save) => {
			console.log("Loaded!");
			this.playerId = save.playerId;
			this.updateView();
			this.startSimulation();
			return this.game;
		});
		loadPromise.then( (game) => {
			this.loadingStatusUpdated("");
		}).catch( (err) => {
			this.loadingStatusUpdated("Error loading!");
			this.logger.log("Error loading "+saveRef, err);
		});
		return loadPromise;
	}
	
	public inspect(ref:string):Promise<any> {
		return this.game.gameDataManager.fetchObject(ref);
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
		if( this.mode != DemoMode.EDIT ) return;
		const coords = this.paintCoordinates;
		if( coords ) {
			this.game.enqueueEntityMessage({
				sourceId: "ui",
				destinationId: this.playerId,
				payload: ["/painttiletreeblock", coords.x, coords.y, coords.z, 1, this.paintEntityClassRef]
			})
		};
	}
	
	public handleMouseEvent(evt:MouseEvent):void {
		if( evt.buttons == 1 ) {
			const cpCoords = this.eventToCanvasPixelCoordinates(evt);
			const coords = this.view.canvasPixelToWorldCoordinates(cpCoords.x, cpCoords.y);
			if( this.keysDown[17] ) {
				const entity:TileEntity|undefined = this.view.getTileEntityAt(coords, 1);
				this.tilePaletteUi.setSlot(this.tilePaletteUi.selectedSlotIndex, entity||null);
			} else {
				this.paintCoordinates = coords;
				this.maybePaint();
			}
		} else {
			this.paintCoordinates = undefined;
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
		
		const input = this.consoleDialog.inputElement;

		if( this.commandHistoryIndex == this.commandHistory.length ) {
			this.commandScratch = input.value;
		}
		
		this.commandHistoryIndex = index;
		const text = index == this.commandHistory.length ? this.commandScratch : this.commandHistory[index];
		input.value = text;
		input.setSelectionRange(text.length, text.length);
	}
	
	public goToCommandHistoryBeginning() { this.goToCommandHistory(0); }
	public goToCommandHistoryEnd() { this.goToCommandHistory(this.commandHistory.length); }
	
	public submitConsoleCommand(cmd?:string) {
		if( cmd == null ) {
			cmd = this.consoleDialog.inputElement.value;
			this.consoleDialog.inputElement.value = "";
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
				tokens.push(token)
			} );
			tokenizer.sourceLocation = {fileUri:"console-input", lineNumber: this.commandHistory.length+1, columnNumber: 1};
			tokenizer.text(cmd.substr(1));
			tokenizer.end();
			if( tokens.length == 0 ) {
				return;
				// do nothing!
			} else {
				doCommand: switch( tokens[0].text ) {
				case 'export-cached-data': case 'ecd':
					this.exportCachedData();
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
				case 'create-new-room':
					{
						const newRoomUuid = newUuidRef();
						this.logger.log("New room ID:", newRoomUuid);
						this.game.enqueueEntityMessage({
							destinationId: simulatorId,
							sourceId: "ui",
							payload: ["/create-room", newRoomUuid]
						});
					}
					break;
				case 'connect-new-room':
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
						this.game.enqueueEntityMessage({
							destinationId: simulatorId,
							sourceId: "ui",
							payload: ["/create-room", newRoomUuid]
						});
						this.game.enqueueEntityMessage({
							destinationId: simulatorId,
							sourceId: "ui",
							payload: ["/connect-rooms", currentLocation.roomRef, dir, newRoomUuid]
						});
						console.log("Connecting "+currentLocation.roomRef+" "+dir+" to "+newRoomUuid);
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
						this.game.enqueueEntityMessage({
							destinationId: simulatorId,
							sourceId: "ui",
							payload: ["/connect-rooms", roomAId, dirName, roomBId],
						});
					}
					break;
				default:
					this.logger.error("Unrecognized command: /"+tokens[0].text);
					break;
				}
			}
		}
		this.addToCommandHistory(cmd);
	}
	
	public popUpConsole(initialText:string) {
		this.goToCommandHistoryEnd();
		this.consoleDialog.inputElement.value = initialText;
		this.consoleDialog.setVisible(true);
		this.consoleDialog.inputElement.setSelectionRange(initialText.length,initialText.length);
		this.consoleDialog.inputElement.focus();
	}
}

export interface SaveGame {
	gameDataRef: string,
	rootRoomId: string,
	playerId: string,
}

class DialogBox {
	public constructor( public element:HTMLElement ) { }
	
	public setVisible(viz:boolean) {
		this.element.style.display = viz ? "" : "none";
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
	demo.canvas = canv;
	demo.datastore = ds;
	demo.memoryDatastore = memds;
	demo.exportDatastore = expds;
	demo.view = v;
	demo.loadingStatusUpdated = loadingStatusUpdated;
	demo.importCacheStrings(cacheStrings);
	
	const tempGdm = new GameDataManager(ds);
	const gameLoaded:Promise<MazeGame> = saveGameRef ? demo.loadGame(saveGameRef) :
		dat.initData(tempGdm)
		.then( () => tempGdm.flushUpdates() )
		.then( (rootNodeUri) => storeObject( {
			gameDataRef: rootNodeUri,
			playerId: dat.playerEntityId,
			rootRoomId: dat.room1Id,
		}, ds ))
		.then( (saveRef) => demo.loadGame(saveRef) );
	
	canv.addEventListener('mousedown', demo.handleMouseEvent.bind(demo));
	canv.addEventListener('mouseup'  , demo.handleMouseEvent.bind(demo));
	canv.addEventListener('mousemove', demo.handleMouseEvent.bind(demo));
	
	const tpArea = document.getElementById('tile-palette-area');
	if( tpArea ) {
		const tpUi = new TilePaletteUI( 16 );
		tpUi.element.style.display = 'none';
		demo.tilePaletteUi = tpUi;
		tpUi.on('select', (index:number, te:TileEntity|undefined|null) => {
			demo.paintEntityClassRef = te ? te.entity.classRef : null;
		});
		tpArea.appendChild( tpUi.element );
		gameLoaded.then( (saveGame) => {
			const entityRenderer = new TileEntityRenderer(demo.game.gameDataManager);
			tpUi.entityRenderer = (ent:Entity, orientation:Quaternion):Promise<string|null> => {
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
			demo.game.enqueueEntityMessage({
				sourceId: "ui",
				destinationId: targetEntityIdBox.value,
				payload: ["/desiredmovementdirection", 0, -1, 0]
			})
		}
		
		const closeDoorButton = document.createElement('button');
		closeDoorButton.appendChild(document.createTextNode("Down"));
		closeDoorButton.onclick = () => {
			demo.game.enqueueEntityMessage({
				sourceId: "ui",
				destinationId: targetEntityIdBox.value,
				payload: ["/desiredmovementdirection", 0, +1, 0]
			})
		}
		
		const udGroup:HTMLElement = document.createElement("fieldset");
		udGroup.appendChild(targetEntityIdBox);
		udGroup.appendChild(openDoorButton);
		udGroup.appendChild(closeDoorButton);
		
		butta.appendChild(udGroup);
		
		const saveButton = document.createElement("button");
		saveButton.appendChild(document.createTextNode("Save"));
		saveButton.onclick = () => {
			const saveNote = window.prompt("Note");
			if( saveNote == null || saveNote.length == 0 ) return;
			saveButton.disabled = true;
			demo.saveGame().then( (saveRef) => {
				const saveMeta = {
					note: saveNote,
					date: new Date().toISOString(),
					saveRef: saveRef,
				};
				http.request(
					'POST', 'http://game21-data.nuke24.net/saves',
					{'content-type':'application/json'},
					encodeObject(saveMeta)
				).then( (res) => {
					if( res.statusCode != 200 ) {
						demo.logger.error("Failed to save to website;", res.content);
					} else {
						demo.logger.log("Saved "+saveRef+" to website");
					}
				});
				demo.logger.log("Saved as "+saveRef);
				if( window.localStorage ) {
					const savesJson = window.localStorage.getItem("game21-local-saves");
					const saves:{note:string,date:string,saveRef:string}[] = savesJson ? JSON.parse(savesJson) : [];
					saves.push(saveMeta);
					window.localStorage.setItem("game21-local-saves", JSON.stringify(saves, null, "\t"));
				}
				saveButton.disabled = false;
			});
		};
		
		butta.appendChild(saveButton);
		
		const loadDialogElem = document.getElementById('load-dialog');
		if( loadDialogElem ) {
			const loadDialog = new DialogBox(loadDialogElem);
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
							loadDialog.setVisible(false);
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
			const helpDialog = new DialogBox(helpDialogElement);
			const helpButton = document.createElement('button');
			helpButton.appendChild(document.createTextNode("Help!"));
			helpButton.onclick = () => helpDialog.setVisible(true);
			const closeHelpButton = document.getElementById('help-close-button');
			if( closeHelpButton ) closeHelpButton.onclick = () => helpDialog.setVisible(false);
			butta.appendChild(helpButton);
		}
	}
	
	const consoleDialogElem = document.getElementById('console-dialog');
	if( consoleDialogElem ) {
		const consoleDialog = <ConsoleDialogBox>new DialogBox(consoleDialogElem);
		consoleDialog.inputElement = <HTMLInputElement>document.getElementById('console-input');
		consoleDialog.inputElement.onkeydown = (keyEvent:KeyboardEvent) => {
			if( keyEvent.keyCode == 38 ) {
				demo.moveThroughCommandHistory(-1);
			} else if( keyEvent.keyCode == 40 ) {
				demo.moveThroughCommandHistory(+1);
			//} else if( keyEvent.keyCode == 36 ) {
			//	demo.goToCommandHistoryBeginning();
			//} else if( keyEvent.keyCode == 35 ) {
			//	demo.goToCommandHistoryEnd();
			} else if( keyEvent.keyCode == 13 ) {
				demo.submitConsoleCommand.bind(demo)();
			}
		};
		
		const consoleCloseButton = document.getElementById('console-close-button')
		if( consoleCloseButton ) consoleCloseButton.onclick = () => consoleDialog.setVisible(false);
		consoleDialogElem.addEventListener('keydown', (keyEvent:KeyboardEvent) => {
			if( keyEvent.keyCode == 27 ) {
				consoleDialog.setVisible(false);
			}
			// Prevent any keys from propagating to the window and messing up our game
			keyEvent.stopPropagation()
		}, false);
		consoleDialogElem.addEventListener('keyup', (keyEvent:KeyboardEvent) => keyEvent.preventDefault());
		
		// Stand firm for what you believe in, until and unless experience proves you wrong.
		// Remember, when the emperor looks naked, the emperor *is* naked.
		// The truth and a lie are not sort of the same thing.
		// And there is no aspect, no facet, no moment of life that can't be improved with pizza.
		
		demo.consoleDialog = consoleDialog;
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
	
	return demo;
}
