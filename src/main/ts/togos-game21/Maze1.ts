import { deepFreeze, thaw, deepThaw, isDeepFrozen } from './DeepFreezer';
import GameDataManager from './GameDataManager';
import HTTPHashDatastore from './HTTPHashDatastore';
import MemoryDatastore from './MemoryDatastore';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import KeyedList from './KeyedList';
import Cuboid from './Cuboid';
import Vector3D from './Vector3D';
import { makeVector, ZERO_VECTOR } from './vector3ds';
import { addVector, subtractVector, vectorIsZero, scaleVector, normalizeVector, roundVectorToGrid } from './vector3dmath';
import Quaternion from './Quaternion';
import TransformationMatrix3D from './TransformationMatrix3D';
import SceneShader, { ShadeRaster } from './SceneShader';
import { uuidUrn, newType4Uuid } from '../tshash/uuids';
import { makeTileTreeRef, tileEntityPaletteRef, eachSubEntity } from './worldutil';
import {
	Room,
	RoomEntity,
	RoomLocation,
	Entity,
	EntityClass,
	TileTree,
	StructureType,
	TileEntityPalette
} from './world';

function newUuidRef():string { return uuidUrn(newType4Uuid()); }

function hexDig(i:number):string {
	return String.fromCharCode( i < 10 ? 48 + i : 87 + i );
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

function hexEncodeBits( pix:Array<number> ):string {
	let enc:string = "";
	for( let i = 0; i+4 <= pix.length; i += 4 ) {
		const num = (pix[i+0]<<3) | (pix[i+1]<<2) | (pix[i+2]<<1) | (pix[i+3]<<0);
		enc += hexDig(num); 
	}
	return enc;
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
		(((col>> 0)&0xFF)/255)+')';
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

const brikPix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
];
const bigBrikPix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
];
const playerPix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,
	0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,
	0,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,
	0,0,0,0,1,0,1,0,1,0,1,0,1,0,0,0,
	0,0,0,0,1,0,1,0,1,0,1,0,1,0,0,0,
	0,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,
	0,0,0,0,1,0,1,1,1,1,1,0,1,0,0,0,
	0,0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,
	0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,
	0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,
	0,0,1,1,1,1,0,0,0,0,0,1,1,1,1,0,
];
const plant1Pix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,
	0,0,0,0,1,0,0,1,0,0,1,0,1,1,0,0,
	0,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,
	0,0,0,0,1,1,1,1,0,0,1,0,1,0,0,0,
	0,0,1,1,0,1,0,0,1,1,1,0,0,1,0,0,
	0,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,
	0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,
	0,0,0,0,1,0,1,0,1,1,1,1,0,1,0,0,
	0,0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,
	0,0,1,1,1,1,0,1,1,0,0,0,0,0,1,0,
	0,1,0,0,0,0,1,1,1,1,1,1,0,0,0,0,
	0,0,0,0,0,0,0,1,1,0,0,0,1,0,0,0,
	0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,
];

interface BitImageInfo {
	bitstr : string;
	color0 : number;
	color1 : number;
}

const oneBitImageDataRegex = /^bitimg:([^,]+),([0-9a-f]+)$/;
function parseBitImg( m:RegExpExecArray ):BitImageInfo {
	const modStrs = m[1].split(';');
	const modVals:KeyedList<any> = {}; // Actually strings!  But any makes |0 happy.
	for( let i = 0; i < modStrs.length; ++i ) {
		const p = modStrs[i].split('=',2);
		if( p.length == 2 ) {
			let v = p[1];
			if( v[0] == '0' && v[1] == 'x' ) {
				throw new Error("Don't handle 0x... colors et");
			}
			modVals[p[0]] = v;
		}
	}
	return {
		bitstr: m[2],
		color0: modVals['color0']|0,
		color1: modVals['color1']|0,
	}
}

// Uhm, hrm, should we use ARGB or RGBA?

function rgbaToNumber( r:number, g:number, b:number, a:number ):number {
	return ((r&0xFF)<<24) | ((g&0xFF)<<16) | ((b&0xFF)<<8) | (a&0xFF);
}

interface MazeItemVisual {
	imageRef : string;
	width : number;
	height : number;
}

interface MazeViewageItem {
	x : number;
	y : number;
	visual : MazeItemVisual;
}

interface MazeViewage {
	items : MazeViewageItem[];
	visibility? : ShadeRaster;
	opacity? : ShadeRaster; // Fer debuggin
}

const brikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(255,255,128,255)+","+hexEncodeBits(brikPix);
const bigBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(255,255,128,255)+","+hexEncodeBits(bigBrikPix);
const playerImgRef = "bitimg:color0=0;color1="+rgbaToNumber(255,255,96,255)+","+hexEncodeBits(playerPix);
const plant1ImgRef = "bitimg:color0=0;color1="+rgbaToNumber(64,255,64,255)+","+hexEncodeBits(plant1Pix);

const mazeData = [
	1,1,1,1,1,1,0,0,1,1,0,1,1,1,1,1,
	0,0,0,0,0,1,0,1,1,0,0,0,1,0,1,0,
	1,1,0,0,0,1,0,0,0,0,0,0,1,0,0,0,
	1,1,1,0,1,1,1,1,1,1,1,0,1,0,1,1,
	1,1,1,0,1,1,1,1,0,0,0,0,0,0,1,1,
	1,1,1,0,1,1,1,2,2,2,2,0,0,0,1,1,
	1,0,0,0,0,1,1,2,0,0,0,0,0,0,0,0,
	1,0,2,2,2,1,1,2,0,1,1,1,1,3,1,0,
	1,0,2,1,1,1,1,2,0,1,0,0,1,1,1,0,
	1,0,2,2,2,2,2,2,0,1,0,0,1,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,3,1,0,0,0,
	1,1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,
	1,1,0,1,1,0,0,2,2,2,2,1,0,0,0,1,
	1,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1,
	1,3,3,3,1,1,0,2,2,2,0,1,0,0,0,1,
	1,1,1,1,1,1,0,0,1,1,0,1,1,1,1,1,
];

export class MazeView {
	public gameDataManager:GameDataManager;
	public constructor( public canvas:HTMLCanvasElement ) { }
	
	protected imageCache:KeyedList<HTMLImageElement> = {};
	public viewage : MazeViewage = { items: [] };

	public occlusionFillStyle:string = 'rgba(96,64,64,1)';

	protected getImage( ref:string ):HTMLImageElement {
		if( this.imageCache[ref] ) return this.imageCache[ref];

		const bitImgRee = oneBitImageDataRegex.exec(ref);
		let xRef = ref;
		if( bitImgRee ) {
			const bitImgInfo = parseBitImg(bitImgRee);
			xRef = parseOneBitImageDataToDataUrl( bitImgInfo.bitstr, 16, 16, bitImgInfo.color0, bitImgInfo.color1 );
		} else {
			throw new Error(ref+" not parse!");
		}

		const img = document.createElement("img");
		img.src = xRef;
		return this.imageCache[ref] = img; 
	}

	public clear():void {
		const ctx = this.canvas.getContext('2d');
		if( !ctx ) return;
		ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
	}

	protected drawRaster(rast:ShadeRaster, drawValue:number, fillStyle:string, drawMargin:boolean, borderColor?:string):void {
		const ctx = this.canvas.getContext('2d');
		if( !ctx ) return;
		const cx = this.canvas.width/2;
		const cy = this.canvas.height/2;
		const ppm = 16;

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
			const rastMinPx = Math.max(0, canvWidth /2 - (rast.originX*ppm));
			const rastMinPy = Math.max(0, canvHeight/2 - (rast.originY*ppm));
			const rastMaxPx = Math.min(canvWidth , rastMinPx + (rast.width /rast.resolution)*ppm);
			const rastMaxPy = Math.min(canvHeight, rastMinPy + (rast.height/rast.resolution)*ppm);

			ctx.fillRect(0,       0,canvWidth,rastMinPy           );
			ctx.fillRect(0,rastMaxPy,canvWidth,canvHeight-rastMinPy);
			ctx.fillRect(0       ,rastMinPy,rastMinPx          ,rastMaxPy-rastMinPy);
			ctx.fillRect(rastMaxPx,rastMinPy,canvWidth-rastMaxPx,rastMaxPy-rastMinPy);
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

		for( i=0, y=0; y<vrHeight; ++y ) {
			let spanStart:number|null = null;
			for( let x=0; x<vrWidth; ++x, ++i ) {
				if( vrData[i] == drawValue ) {
					if( spanStart == null ) spanStart = x;
				} else if( spanStart != null ) {
					fillFog(spanStart, x);
					spanStart = null;
				}
			}
			if( spanStart != null ) {
				fillFog(spanStart, vrWidth);
			}
		}
	}

	protected drawOcclusionFog(viz:ShadeRaster):void {
		this.drawRaster( viz, 0, this.occlusionFillStyle, true);
	}

	public draw():void {
		const ctx = this.canvas.getContext('2d');
		if( !ctx ) return;
		const cx = this.canvas.width/2;
		const cy = this.canvas.height/2;
		const ppm = 16;
		for( let i in this.viewage.items ) {
			const item = this.viewage.items[i];
			const img = this.getImage(item.visual.imageRef);
			const px = (item.x-item.visual.width/2 ) * ppm + cx;
			const py = (item.y-item.visual.height/2) * ppm + cy;
			ctx.drawImage(img, px, py);
		}
		if(this.viewage.visibility) this.drawOcclusionFog(this.viewage.visibility);
	}
}

const HUNIT_CUBE:Cuboid = new Cuboid(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5); 

function makeTileEntityPalette( gdm:GameDataManager ):string {
	return tileEntityPaletteRef( [
		null,
		gdm.fastStoreObject<EntityClass>( {
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: HUNIT_CUBE,
			physicalBoundingBox: HUNIT_CUBE,
			visualBoundingBox: HUNIT_CUBE,
			isInteractive: true,
			isRigid: true,
			mass: Infinity,
			opacity: 1,
			visualRef: brikImgRef
		} ),
		gdm.fastStoreObject<EntityClass>( {
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: HUNIT_CUBE,
			physicalBoundingBox: HUNIT_CUBE,
			visualBoundingBox: HUNIT_CUBE,
			isInteractive: true,
			isRigid: true,
			mass: Infinity,
			opacity: 1,
			visualRef: bigBrikImgRef
		} ),
		gdm.fastStoreObject<EntityClass>( {
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: HUNIT_CUBE,
			physicalBoundingBox: HUNIT_CUBE,
			visualBoundingBox: HUNIT_CUBE,
			isInteractive: false,
			isRigid: false,
			mass: Infinity,
			opacity: 0.25,
			visualRef: plant1ImgRef
		} ),
	], gdm );
}

function makeRoom( gdm:GameDataManager ):string {
	const tileTreeRef = makeTileTreeRef( makeTileEntityPalette(gdm), 16, 16, 1, mazeData, gdm );
	const roomRef = newUuidRef();
	const roomBounds = new Cuboid(-8, -8, -0.5, 8, 8, 0.5);
	const room:Room = {
		bounds: roomBounds,
		roomEntities: {
			[newUuidRef()]: {
				position: makeVector(0,0,0),
				entity: {
					classRef: tileTreeRef
				}
			}
		},
		neighbors: {
			"w": {
				offset: makeVector(-16, 0, 0),
				bounds: roomBounds,
				roomRef: roomRef
			},
			"e": {
				offset: makeVector(+16, 0, 0),
				bounds: roomBounds,
				roomRef: roomRef
			},
			"n": {
				offset: makeVector(0, -16, 0),
				bounds: roomBounds,
				roomRef: roomRef
			},
			"s": {
				offset: makeVector(0, +16, 0),
				bounds: roomBounds,
				roomRef: roomRef
			},
		}
	}
	gdm.fastStoreObject(room, roomRef);
	return roomRef;
}

function roomToMazeViewage( roomRef:string, roomX:number, roomY:number, gdm:GameDataManager, viewage:MazeViewage, visibility:ShadeRaster ):void {
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
				if( visibility.data[visibility.width*vry+vrx] ) {
					visible = true;
					break isVisibleLoop;
				}
			}

			// TODO: Re-use items, visuals
			if( visible ) viewage.items.push( {
				x: position.x,
				y: position.y,
				visual: {
					width: 1,
					height: 1,
					imageRef: entityClass.visualRef
				}
			})
		}
		eachSubEntity( entity, position, gdm, _entityToMazeViewage );
	};

	for( let re in room.roomEntities ) {
		const roomEntity = room.roomEntities[re];
		const orientation = roomEntity.orientation ? roomEntity.orientation : Quaternion.IDENTITY;
		_entityToMazeViewage( roomEntity.entity, makeVector(roomX+roomEntity.position.x, roomY+roomEntity.position.y, roomEntity.position.z), orientation );
	}
}
function sceneToMazeViewage( roomRef:string, roomX:number, roomY:number, gdm:GameDataManager, viewage:MazeViewage, visibility:ShadeRaster ):void {
	const room = gdm.getRoom(roomRef);
	if( room == null ) throw new Error("Failed to load room "+roomRef);
	roomToMazeViewage( roomRef, roomX, roomY, gdm, viewage, visibility );
	for( let n in room.neighbors ) {
		const neighb = room.neighbors[n];
		roomToMazeViewage( neighb.roomRef, roomX+neighb.offset.x, roomY+neighb.offset.y, gdm, viewage, visibility );
	}
}

enum CardinalDirection {
	EAST = 0,
	SOUTHEAST = 1,
	SOUTH = 2,
	SOUTHWEST = 3,
	WEST = 4,
	NORTHWEST = 5,
	NORTH = 6,
	NORTHEAST = 7
}

function cardinalDirectionToVec( dir:CardinalDirection ):Vector3D {
	switch( dir ) {
	case CardinalDirection.EAST: return makeVector(1,0,0);
	case CardinalDirection.SOUTHEAST: return makeVector(1,1,0);
	case CardinalDirection.SOUTH: return makeVector(0,1,0);
	case CardinalDirection.SOUTHWEST: return makeVector(-1,1,0);
	case CardinalDirection.WEST: return makeVector(-1,0,0);
	case CardinalDirection.NORTHWEST: return makeVector(-1,-1,0);
	case CardinalDirection.NORTH: return makeVector(0,-1,0);
	case CardinalDirection.NORTHEAST: return makeVector(1,-1,0);
	default: return ZERO_VECTOR;
	}
}

interface RoomEntityUpdate {
	roomRef? : string;
	position? : Vector3D;
	velocityPosition? : Vector3D;
}

interface Collision {
	/* For now I don't care, but here's some info that may be useful later:
	roomRef : string;
	relativePosition : Vector3D;
	roomEntity : RoomEntity;
	*/
}

const entityPositionBuffer:Vector3D = makeVector(0,0,0);
const rotate45Clockwise:TransformationMatrix3D        = deepFreeze(TransformationMatrix3D.fromXYZAxisAngle(0,0,1,+Math.PI/4));
const rotate45CounterClockwise:TransformationMatrix3D = deepFreeze(TransformationMatrix3D.fromXYZAxisAngle(0,0,1,-Math.PI/4));
const movementAttemptTransforms = [
	TransformationMatrix3D.IDENTITY,
	rotate45Clockwise,
	rotate45CounterClockwise
];

export class MazeGame {
	protected rooms:KeyedList<Room> = {};

	public constructor( public gameDataManager:GameDataManager ) { }

	protected getMutableRoom( roomId:string ):Room {
		if( this.rooms[roomId] ) return this.rooms[roomId];
		
		let room = this.gameDataManager.getRoom(roomId);
		
		room = thaw(room);
		room.roomEntities = thaw(room.roomEntities);
		for( let re in room.roomEntities ) {
			room.roomEntities[re] = thaw(room.roomEntities[re]);
			room.roomEntities[re].entity = thaw(room.roomEntities[re].entity);
		}
		// Apparently deepThaw doesn't quite work, yet
		this.rooms[roomId] = room; // deepThaw(room);
		return room;
	}
	
	protected getRoom( roomId:string ):Room {
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
	
	protected fixLocation(loc:RoomLocation):RoomLocation {
		let room = this.getMutableRoom(loc.roomRef);
		if( !Cuboid.containsVector(room.bounds, loc.position) ) for( let n in room.neighbors ) {
			const neighb = room.neighbors[n];
			const fixedPos = subtractVector(loc.position, neighb.offset);
			if( Cuboid.containsVector(neighb.bounds, fixedPos) ) {
				return {
					roomRef: neighb.roomRef,
					position: fixedPos,
				};
			}
		}
		return loc;
	}

	protected updateRoomEntity( roomRef:string, entityId:string, update:RoomEntityUpdate ):void {
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

	protected _collisionsAt3( entityPos:Vector3D, entity:Entity, pos:Vector3D, bb:Cuboid, into:Collision[] ):void {
		const proto = this.gameDataManager.getEntityClass( entity.classRef );
		if( proto.isInteractive === false ) return;
		if( !Cuboid.intersectsWithOffset(entityPos, proto.physicalBoundingBox, pos, bb) ) return;

		if( proto.structureType == StructureType.INDIVIDUAL ) {
			if( proto.isInteractive && proto.isRigid ) {
				into.push( {} );
			}
		} else {
			eachSubEntity( entity, entityPos, this.gameDataManager, (subEnt, subEntPos, ori) => {
				this._collisionsAt3( subEntPos, subEnt, pos, bb, into );
			}, this, entityPos);
		};
	}
	
	protected _collisionsAt2( roomPos:Vector3D, roomRef:string, pos:Vector3D, bb:Cuboid, ignoreEntityId:string, into:Collision[] ):void {
		// Room bounds have presumably already been determined to intersect
		// with that of the box being checked, so we'll skip that and go
		// straight to checking entities.
		const room:Room = this.getRoom(roomRef);
		for( let re in room.roomEntities ) {
			if( re == ignoreEntityId ) continue;
			const roomEntity = room.roomEntities[re];
			addVector( roomPos, roomEntity.position, entityPositionBuffer );
			this._collisionsAt3(entityPositionBuffer, roomEntity.entity, pos, bb, into)
		}
	}
	
	/** Overly simplistic 'is there anything at this exact point' check */
	protected collisionsAt( roomRef:string, pos:Vector3D, bb:Cuboid, ignoreEntityId:string ):Collision[] {
		const collisions:Collision[] = [];
		const room = this.getRoom(roomRef);
		if( Cuboid.intersectsWithOffset(ZERO_VECTOR, room.bounds, pos, bb) ) {
			this._collisionsAt2( ZERO_VECTOR, roomRef, pos, bb, ignoreEntityId, collisions );
		}
		for( let n in room.neighbors ) {
			const neighb = room.neighbors[n];
			if( Cuboid.intersectsWithOffset(neighb.offset, neighb.bounds, pos, bb) ) {
				this._collisionsAt2( neighb.offset, neighb.roomRef, pos, bb, ignoreEntityId, collisions );
			}
		}
		return collisions;
	}
	
	public playerEntityId?:string;
	public playerMoveDir:CardinalDirection|undefined = undefined;
	public update(interval:number=1/16) {
		for( let r in this.rooms ) {
			let room = this.rooms[r];
			for( let re in room.roomEntities ) {
				if( re == this.playerEntityId ) {
					room.roomEntities[re].entity.desiredMovementDirection = this.playerMoveDir != null ?
						cardinalDirectionToVec(this.playerMoveDir) : undefined;
				}
			}
		}
		for( let r in this.rooms ) {
			let room = this.rooms[r];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				const entity = roomEntity.entity;
				if( entity.desiredMovementDirection ) {
					const entityClass = this.gameDataManager.getEntityClass(entity.classRef);
					roomEntity.velocity = normalizeVector(entity.desiredMovementDirection, entityClass.normalWalkingSpeed);
				} else delete roomEntity.velocity;
				if( roomEntity.velocity && !vectorIsZero(roomEntity.velocity) ) {
					const snapGridSize = 1/8; // Maybe should vary based on entity size
					const entityClass = this.gameDataManager.getEntityClass(entity.classRef);
					const delta = scaleVector(roomEntity.velocity, interval);
					const p0 = roomEntity.velocityPosition ? roomEntity.velocityPosition : roomEntity.position;
					const movementBufferVector = makeVector();
					
					shoveIt:
					for( let scale = 1; scale >= snapGridSize; scale /= 2 ) {
						for( let t in movementAttemptTransforms ) {
							const transform = movementAttemptTransforms[t];
							scaleVector(delta, scale, movementBufferVector);
							transform.multiplyVector(movementBufferVector, movementBufferVector);
							addVector(p0, movementBufferVector, movementBufferVector);
							const newVLoc:RoomLocation = this.fixLocation({
								roomRef: r,
								position: movementBufferVector,
							});
							const newLoc:RoomLocation = {
								roomRef: newVLoc.roomRef, // As long as gridSize <= 1, this should be okay, I think?
								position: roundVectorToGrid(newVLoc.position, snapGridSize)
							};
							if( this.collisionsAt(newLoc.roomRef, newLoc.position, entityClass.physicalBoundingBox, re).length == 0 ) {
								this.updateRoomEntity(r, re, {
									roomRef: newLoc.roomRef,
									position: newLoc.position,
									velocityPosition: newVLoc.position
								});
								break shoveIt;
							}
						}
					}
				}
			}
		}
		for( let r in this.rooms ) {
			const room = this.rooms[r];
			if( !isDeepFrozen(room) ) {
				// For now we have to do this so that the view will see them,
				// since gdm doesn't have any way to track objects without saving them.
				// But it should eventually.
				const urn = this.gameDataManager.fastStoreObject(room, r);
			}
		}
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

export class MazeDemo {
	public game : MazeGame;
	public view : MazeView;
	public playerId : string;

	public startSimulation() {
		setInterval(this.tick.bind(this), 1000/16);
	}
	
	protected tick() {
		this.game.update(1/16);
		this.updateView();
	}

	public walk(dir:CardinalDirection|undefined):void {
		this.game.playerMoveDir = dir;
	}
	
	public updateView() {
		this.view.viewage = { items: [] };
		
		const playerLoc = this.game.locateRoomEntity(this.playerId);

		if( playerLoc ) {
			const rasterWidth = 31;
			const rasterHeight = 31;
			const rasterResolution = 2;
			const distance = 16;
			// Line up raster origin so it falls as close as possible to the center of the raster
			// while lining up edges with world coordinates
			const rasterOriginX = Math.floor(rasterWidth /rasterResolution/2) + playerLoc.position.x - Math.floor(playerLoc.position.x);
			const rasterOriginY = Math.floor(rasterHeight/rasterResolution/2) + playerLoc.position.y - Math.floor(playerLoc.position.y);
			const distanceInPixels = rasterResolution*distance;
			const opacityRaster = new ShadeRaster(rasterWidth, rasterHeight, rasterResolution, rasterOriginX, rasterOriginY);
			const visibilityRaster   = new ShadeRaster(rasterWidth, rasterHeight, rasterResolution, rasterOriginX, rasterOriginY);
			const sceneShader = new SceneShader(this.game.gameDataManager);
			sceneShader.sceneOpacityRaster(playerLoc.roomRef, scaleVector(playerLoc.position, -1), opacityRaster);
			if( isAllZero(opacityRaster.data) ) console.log("Opacity raster is all zero!");
			if( isAllNonZero(opacityRaster.data) ) console.log("Opacity raster is all nonzero!");
			sceneShader.opacityTolVisibilityRaster(opacityRaster, rasterOriginX*rasterResolution, rasterOriginY*rasterResolution, distanceInPixels, visibilityRaster);
			if( isAllZero(visibilityRaster.data) ) console.log("Visibility raster is all zero!");
			if( isAllNonZero(visibilityRaster.data) ) console.log("Visibility raster is all nonzero!");
			sceneShader.growVisibility(visibilityRaster); // Not quite!  Since this expands visibility into non-room space.
			/*
			for( let i=0, y=0; y<visibilityRaster.height; ++y ) {
				for( let x=0; x<visibilityRaster.width; ++x, ++i ) {
					if( visibilityRaster.data[i] ) {
						this.view.viewage.items.push( {
							x: x / visibilityRaster.resolution - visibilityRaster.originX,
							y: y / visibilityRaster.resolution - visibilityRaster.originY,
							visual: {
								width: 1 / visibilityRaster.resolution,
								height: 1 / visibilityRaster.resolution,
								imageRef: [plant1ImgRef,brikImgRef,bigBrikImgRef][visibilityRaster.data[i] % 3]
							}
						})
					}
				}
			}*/
			sceneToMazeViewage( playerLoc.roomRef, -playerLoc.position.x, -playerLoc.position.y, this.game.gameDataManager, this.view.viewage, visibilityRaster );
			this.view.viewage.visibility = visibilityRaster;
			this.view.viewage.opacity = opacityRaster;
		} else {
			console.log("Failed to locate player, "+this.playerId);
		}
		
		this.view.clear();
		this.view.draw();
	}
	
	protected keysDown:KeyedList<boolean> = {};
	protected keysUpdated() {
		let up=false,down=false,left=false,right=false;
		
		if( this.keysDown[68] ) right = true;
		if( this.keysDown[65] ) left = true;
		if( this.keysDown[83] ) down = true;
		if( this.keysDown[87] ) up = true;
		
		if( left && right ) left = right = false;
		if( up && down ) up = down = false;
		
		this.game.playerMoveDir =
			right && up ? CardinalDirection.NORTHEAST :
			right && down ? CardinalDirection.SOUTHEAST :
			right ? CardinalDirection.EAST :
			left && up ? CardinalDirection.NORTHWEST :
			left && down ? CardinalDirection.SOUTHWEST :
			left ? CardinalDirection.WEST :
			up ? CardinalDirection.NORTH :
			down ? CardinalDirection.SOUTH :
			undefined;
	}
	public keyDown(keyEvent:KeyboardEvent):void {
		this.keysDown[keyEvent.keyCode] = true;
		this.keysUpdated();
	}
	public keyUp(keyEvent:KeyboardEvent):void {
		delete this.keysDown[keyEvent.keyCode];
		this.keysUpdated();
	}
}

export function startDemo(canv:HTMLCanvasElement) : MazeDemo {
	const ds = MemoryDatastore.createSha1Based(0); //HTTPHashDatastore();
	const dbmm = new DistributedBucketMapManager<string>(ds);
	const gdm = new GameDataManager(ds, dbmm);
	
	const playerId = newUuidRef();
	const playerClass:EntityClass = {
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: HUNIT_CUBE,
		physicalBoundingBox: HUNIT_CUBE,
		visualBoundingBox: HUNIT_CUBE,
		isAffectedByGravity: false,
		visualRef: playerImgRef,
		normalWalkingSpeed: 4,
		normalClimbingSpeed: 2,
	};
	const playerRoomEntity:RoomEntity = {
		position: makeVector(-6.5, -1.5, 0),
		entity: {
			id: playerId,
			classRef: gdm.fastStoreObject<EntityClass>(playerClass)
		}
	};
	
	const roomRef = makeRoom(gdm);
	const room = thaw(gdm.getRoom(roomRef));
	if( room == null ) throw new Error("Failed to load "+roomRef);
	room.roomEntities = thaw(room.roomEntities);
	room.roomEntities[playerId] = playerRoomEntity;
	gdm.fastStoreObject(room, roomRef);
	
	const game = new MazeGame(gdm);
	game.playerEntityId = playerId;
	
	const v = new MazeView(canv);
	v.gameDataManager = gdm;
	const viewItems : MazeViewageItem[] = [];
	
	const demo = new MazeDemo();
	demo.game = game;
	demo.view = v;
	demo.playerId = playerId;
	demo.startSimulation();
	
	game.fullyLoadRoom( roomRef ).then( (room) => {
		demo.updateView();
	});
	
	return demo;
}
