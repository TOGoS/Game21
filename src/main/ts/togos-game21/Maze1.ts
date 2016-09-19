import { thaw, deepThaw, isDeepFrozen } from './DeepFreezer';
import GameDataManager from './GameDataManager';
import HTTPHashDatastore from './HTTPHashDatastore';
import MemoryDatastore from './MemoryDatastore';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import KeyedList from './KeyedList';
import Cuboid from './Cuboid';
import Vector3D from './Vector3D';
import Quaternion from './Quaternion';
import SceneShader, { ShadeRaster } from './SceneShader';
import { uuidUrn, newType4Uuid } from '../tshash/uuids';
import { makeTileTreeRef, tileEntityPaletteRef, eachSubEntity } from './worldutil';
import {
	Room,
	RoomEntity,
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
}

const brikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(255,255,128,255)+","+hexEncodeBits(brikPix);
const bigBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(255,255,128,255)+","+hexEncodeBits(bigBrikPix);
const playerImgRef = "bitimg:color0=0;color1="+rgbaToNumber(255,255,96,255)+","+hexEncodeBits(playerPix);

const brikVisual:MazeItemVisual = {
	width: 1,
	height: 1,
	imageRef: brikImgRef
};

const bigBrikVisual:MazeItemVisual = {
	width: 1,
	height: 1,
	imageRef: bigBrikImgRef
};

const mazeData = [
	1,1,1,1,1,1,0,0,1,1,0,1,1,1,1,1,
	0,0,0,0,0,1,0,1,1,0,0,0,1,0,1,0,
	1,1,0,0,0,1,0,0,0,0,0,0,1,0,0,0,
	1,1,1,0,1,1,1,1,1,1,1,0,1,0,1,1,
	1,1,1,0,1,1,1,1,0,0,0,0,0,0,1,1,
	1,1,1,0,1,1,1,2,2,2,2,0,0,0,1,1,
	1,0,0,0,0,1,1,2,0,0,0,0,0,0,0,0,
	1,0,2,2,2,1,1,2,0,1,1,1,1,0,1,0,
	1,0,2,1,1,1,1,2,0,1,0,0,1,1,1,0,
	1,0,2,2,2,2,2,2,0,1,0,0,1,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,
	1,1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,
	1,1,0,1,1,0,0,2,2,2,2,1,0,0,0,1,
	1,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1,
	1,0,0,0,1,1,0,2,2,2,0,1,0,0,0,1,
	1,1,1,1,1,1,0,0,1,1,0,1,1,1,1,1,
];

/*
interface OpacityRaster {
	scale:number; // Size of each tile; also width,height
	width:number; // Number of tiles wide
	height:number; // Number of tiles high
	opacities:number[];
	originX:number;
	originY:number;
}

function entityToOpacityRaster(
	raster:OpacityRaster, eneity:Entity
)

function roomContentToOpacityRaster(
	raster:OpacityRaster, roomRef:string, x:number, y:number, gdm:GameDataManager
):void {
	const rMinX = -raster.originX;
	const rMinY = -raster.originY;
	const rMaxX = rMinX + raster.width *raster.scale;
	const rMaxY = rMinY + raster.height*raster.scale;
	const room = <Room>gdm.getObject(roomRef);
	for( let re in room.roomEntities ) {
		const roomEntity = room.roomEntities[re];
		const entityClass = <EntityClass>gdm.getObject(roomEntity.entity.classRef);
		if( entityClass == null ) continue;

		const pos = roomEntity.position;
		const vbb = entityClass.visualBoundingBox;
		const ex = x + pos.x;
		const ey = y + pos.y;  
		if( x + vbb.minX >= rMaxX ) continue;
		if( entityClass.opacity )
	}
}

function opacityRaster(
	originRoomRef:string, originX:number, originY:number, minX:number, minY:number, maxX:number, maxY:number, scale:number, gdm:GameDataManager
):OpacityRaster {
	const width = Math.ceil(maxX - minX);
	const height = Math.ceil(maxY - minY);
	const raster = {
		width: width,
		height: height,
		scale: scale,
		opacities: new Array<number>( width*height ),
		originX: -minX,
		originY: -minY,
	};
	const room = <Room>gdm.getObject(originRoomRef);
	if( room != null ) {
		const roomX = -originX, roomY = -originY;
		roomContentToOpacityRaster( raster, originRoomRef, roomX, roomY, gdm );
		for( let n in room.neighbors ) {
			const neighb = room.neighbors[n];
			roomContentToOpacityRaster( raster, neighb.roomRef, roomX+neighb.offset.x, roomY+neighb.offset.y, gdm );
		}
	}

	return raster;
}
*/

function traceView( originRoomRef:string, originX:number, originY:number, originZ:number, gdm:GameDataManager ):MazeViewage {
	const viewage:MazeViewage = { items: [] };

	const sceneShader:SceneShader = new SceneShader(gdm);
	throw new Error("traceView not yet implementse");
	//return viewage;
}

export class MazeView {
	public gameDataManager:GameDataManager;
	public constructor( public canvas:HTMLCanvasElement ) { }
	
	protected imageCache:KeyedList<HTMLImageElement> = {};
	public viewage : MazeViewage = {
		items: [
			{
				x: -1,
				y: -1,
				visual: bigBrikVisual
			}
		]
	};

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

	public draw():void {
		const ctx = this.canvas.getContext('2d');
		if( !ctx ) return;
		const cx = this.canvas.width/2;
		const cy = this.canvas.height/2;
		ctx.fillStyle = 'rgba(255,255,255,1.0)';
		//ctx.fillRect(0,0,16,16);

		//const brikImg = this.getImage(brikImgRef);
		//ctx.drawImage(brikImg, 0, 0);
		for( let i in this.viewage.items ) {
			const item = this.viewage.items[i];
			const img = this.getImage(item.visual.imageRef);
			const px = (item.x-item.visual.width/2 ) * 16 + cx;
			const py = (item.y-item.visual.height/2) * 16 + cy;
			ctx.drawImage(img, px, py);
		}
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
			visualRef: bigBrikImgRef
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
				position: new Vector3D(0,0,0),
				entity: {
					classRef: tileTreeRef
				}
			}
		},
		neighbors: {
			"w": {
				offset: new Vector3D(-16, 0, 0),
				bounds: roomBounds,
				roomRef: roomRef
			},
			"e": {
				offset: new Vector3D(+16, 0, 0),
				bounds: roomBounds,
				roomRef: roomRef
			},
			"n": {
				offset: new Vector3D(0, -16, 0),
				bounds: roomBounds,
				roomRef: roomRef
			},
			"s": {
				offset: new Vector3D(0, +16, 0),
				bounds: roomBounds,
				roomRef: roomRef
			},
		}
	}
	gdm.fastStoreObject(room, roomRef);
	return roomRef;
}

function roomToMazeViewage( roomRef:string, roomX:number, roomY:number, gdm:GameDataManager, viewage:MazeViewage ):void {
	const room = gdm.getRoom(roomRef);
	if( room == null ) throw new Error("Failed to load room "+roomRef);

	let _entityToMazeViewage = ( entity:Entity, position:Vector3D, orientation:Quaternion  ) => {}
	_entityToMazeViewage = ( entity:Entity, position:Vector3D, orientation:Quaternion ) => {
		const entityClass = gdm.getEntityClass(entity.classRef);
		if( entityClass == null ) throw new Error("Failed to load entity class "+entity.classRef);
		if( entityClass.visualRef ) {
			viewage.items.push( {
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
		_entityToMazeViewage( roomEntity.entity, new Vector3D(roomX+roomEntity.position.x, roomY+roomEntity.position.y, roomEntity.position.z), orientation );
	}
}
function roomAndNeighborsToMazeViewage( roomRef:string, roomX:number, roomY:number, gdm:GameDataManager, viewage:MazeViewage ):void {
	const room = gdm.getRoom(roomRef);
	if( room == null ) throw new Error("Failed to load room "+roomRef);
	roomToMazeViewage( roomRef, roomX, roomY, gdm, viewage );
	for( let n in room.neighbors ) {
		const neighb = room.neighbors[n];
		roomToMazeViewage( neighb.roomRef, roomX+neighb.offset.x, roomY+neighb.offset.y, gdm, viewage );
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
	case CardinalDirection.EAST: return new Vector3D(1,0,0);
	case CardinalDirection.SOUTHEAST: return new Vector3D(1,1,0);
	case CardinalDirection.SOUTH: return new Vector3D(0,1,0);
	case CardinalDirection.SOUTHWEST: return new Vector3D(-1,1,0);
	case CardinalDirection.WEST: return new Vector3D(-1,0,0);
	case CardinalDirection.NORTHWEST: return new Vector3D(-1,-1,0);
	case CardinalDirection.NORTH: return new Vector3D(0,-1,0);
	case CardinalDirection.NORTHEAST: return new Vector3D(1,-1,0);
	default: return Vector3D.ZERO;
	}
}

interface RoomLocation {
	roomRef : string;
	position : Vector3D;
}

interface RoomEntityUpdate {
	roomRef? : string;
	position? : Vector3D;
}

export class MazeGame {
	protected rooms:KeyedList<Room> = {};

	public constructor( public gameDataManager:GameDataManager ) { }

	protected getRoom( roomId:string ):Room {
		if( this.rooms[roomId] ) return this.rooms[roomId];
		throw new Error("Room "+roomId+" not loaded");
	}

	public fullyLoadRoom( roomId:string ):Promise<Room> {
		return this.gameDataManager.fullyLoadRoom(roomId).then( (room) => {
			room = thaw(room);
			room.roomEntities = thaw(room.roomEntities);
			for( let re in room.roomEntities ) {
				room.roomEntities[re] = thaw(room.roomEntities[re]);
			}
			// Apparently deepThaw doesn't quite work, yet
			this.rooms[roomId] = room; // deepThaw(room);
			return room;
		});
	}

	protected fixLocation(loc:RoomLocation):RoomLocation {
		let room = this.rooms[loc.roomRef];
		if( !Cuboid.containsVector(room.bounds, loc.position) ) for( let n in room.neighbors ) {
			const neighb = room.neighbors[n];
			const fixedPos = Vector3D.subtract(loc.position, neighb.offset);
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
		let room : Room = this.rooms[roomRef];
		let roomEntity = room.roomEntities[entityId];
		if( update.position ) roomEntity.position = update.position;
		if( update.roomRef != null && update.roomRef != roomRef ) {
			let newRoom : Room = this.rooms[update.roomRef];
			newRoom.roomEntities[entityId] = roomEntity;
			delete room.roomEntities[entityId];
		}
	}

	protected collisionAt2( entity:Entity, samplePosition:Vector3D, ignoreEntityId:string ):boolean {
		const proto = this.gameDataManager.getEntityClass( entity.classRef );
		if( proto.isInteractive === false ) return false;
		if( !Cuboid.containsVector(proto.physicalBoundingBox, samplePosition) ) return false;
		if( proto.structureType == StructureType.INDIVIDUAL ) {
			return !!(proto.isInteractive && proto.isRigid);
		} else return !!eachSubEntity( entity, Vector3D.ZERO, this.gameDataManager, (subEnt, subEntPos, ori) => {
			if( this.collisionAt2(subEnt, Vector3D.subtract(samplePosition, subEntPos), ignoreEntityId) ) return true;
			return undefined;
		});
	}

	/** Overly simplistic 'is there anything at this exact point' check */
	protected collisionAt( roomRef:string, position:Vector3D, ignoreEntityId:string ):boolean {
		const room = this.rooms[roomRef];
		for( let re in room.roomEntities ) {
			if( re == ignoreEntityId ) continue;
			const roomEntity = room.roomEntities[re];
			if( this.collisionAt2(roomEntity.entity, Vector3D.subtract(position, roomEntity.position), ignoreEntityId) ) return true;
		}
		return false;
	}

	public playerEntityId?:string;
	public playerMoveDir:CardinalDirection|undefined = undefined;
	public update() {
		for( let r in this.rooms ) {
			let room = this.rooms[r];
			for( let re in room.roomEntities ) {
				if( re == this.playerEntityId && this.playerMoveDir != null ) {
					const delta = cardinalDirectionToVec(this.playerMoveDir);
					if( delta.isZero ) continue;
					let roomEntity = room.roomEntities[re];
					const newLoc = this.fixLocation({
						roomRef: r,
						position: Vector3D.add(roomEntity.position, delta)
					});
					if( !this.collisionAt(newLoc.roomRef, newLoc.position, re) ) {
						this.updateRoomEntity(r, re, {
							roomRef: newLoc.roomRef,
							position: newLoc.position
						})
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

export class MazeDemo {
	public game : MazeGame;
	public view : MazeView;
	public playerId : string;

	public setUp() {

	}

	public walk(dir:CardinalDirection|undefined):void {
		this.game.playerMoveDir = dir;
		this.update();
	}
	
	public update() {
		this.game.update();
		this.updateView();
	}

	public updateView() {
		this.view.viewage = { items: [] };
		
		const playerLoc = this.game.locateRoomEntity(this.playerId);

		if( playerLoc ) {
			roomAndNeighborsToMazeViewage( playerLoc.roomRef, -playerLoc.position.x, -playerLoc.position.y, this.game.gameDataManager, this.view.viewage );
		} else {
			console.log("Failed to locate player, "+this.playerId);
		}
		
		this.view.clear();
		this.view.draw();
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
		visualRef: playerImgRef
	};
	const playerRoomEntity:RoomEntity = {
		position: new Vector3D(-6.5, -1.5, 0),
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
	const sceneShader:SceneShader = new SceneShader(gdm);
	const shadeRaster = new ShadeRaster(64, 48, 1, 32, 24);
	sceneShader.sceneOpacityRaster(roomRef, new Vector3D(3.5, 3.5, 0), shadeRaster);

	const game = new MazeGame(gdm);
	game.playerEntityId = playerId;

	const v = new MazeView(canv);
	v.gameDataManager = gdm;
	const viewItems : MazeViewageItem[] = [];

	const demo = new MazeDemo();
	demo.game = game;
	demo.view = v;
	demo.playerId = playerId;

	game.fullyLoadRoom( roomRef ).then( (room) => {
		demo.updateView();
	});

	return demo;
}