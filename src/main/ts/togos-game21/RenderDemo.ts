import Quaternion from './Quaternion';
import Vector3D from './Vector3D';
import ImageSlice from './ImageSlice';
import Datastore from './Datastore';
import MemoryDatastore from './MemoryDatastore';
import HTTPHashDatastore from './HTTPHashDatastore';
import CachingDatastore from './CachingDatastore';
import GameDataManager from './GameDataManager';
import { VisualImageManager } from './rendering';
import { DEFAULT_LIGHTS } from './lights';
import { DEFAULT_MATERIAL_PALETTE } from './surfacematerials';
import * as dat from './maze1demodata'
import { isResolved, isRejected, value, error } from './promises';

function sleep(interval:number):Promise<void> {
	return new Promise<void>( (resolve,reject) => {
		setTimeout(resolve, interval);
	});
}

function leMod( num:number, modBy:number ) {
	return num - modBy*Math.floor(num / modBy);
}

interface LiteEntity {
	position: Vector3D;
	orientation: Quaternion;
	visualRef: string;
	state: {[k:string]: any};
	animationStartTime: number;
}

export class RenderDemo {
	protected gameDataManager:GameDataManager;
	protected datastore:Datastore<Uint8Array>;
	protected imageManager:VisualImageManager;
	
	public constructor(protected canvas:HTMLCanvasElement) {
		const httpDs:Datastore<Uint8Array> = HTTPHashDatastore.createDefault();
		const memds:Datastore<Uint8Array> = MemoryDatastore.createSha1Based(0);
		this.datastore = new CachingDatastore(memds.identify,
			memds,
			httpDs
		);
		this.gameDataManager = new GameDataManager(this.datastore);
		this.imageManager = new VisualImageManager({
			lights: DEFAULT_LIGHTS,
			materialRefs: DEFAULT_MATERIAL_PALETTE,
			dictionaryRootRef: "xxx",
		}, this.gameDataManager, {
			animationResolution: this.framesPerSecond
		});
	}
	
	protected frameNumber:number = 0;
	protected framesPerSecond:number = 30;
	
	protected ifResolvedThen<T,V>( prom:Thenable<T>, callback:(thing:T)=>Thenable<V>, errCallback?:(err:any)=>any ):void {
		if( isResolved(prom) ) {
			callback(value(prom));
		} else if( isRejected(prom) ) {
			if( errCallback ) errCallback(error(prom));
		}
	}
	
	protected drawFrame() {
		const ctx = this.canvas.getContext('2d');
		if( ctx == null ) {
			console.error("No 2d context");
			return;
		}
		
		const fn = this.frameNumber;
		
		let entities:LiteEntity[] = [
			{
				position: {x:1,y:1,z:0},
				orientation: Quaternion.fromXYZAxisAngle( 0,1,0, leMod(fn, this.framesPerSecond) * Math.PI*2 ),
				state: {
					switchState: leMod(this.frameNumber, 14) < 7
				},
				animationStartTime: 0,
				visualRef: dat.wiredToggleBoxVisualRef
			},
			{
				position: {x:2,y:1,z:0},
				orientation: Quaternion.fromXYZAxisAngle( 0,1,0, leMod(fn, this.framesPerSecond) * Math.PI*2 ),
				state: {},
				animationStartTime: 0.5,
				visualRef: 'urn:sha1:PLOIWGVPQYMLDYKBPAIV5JOQ5HT5GT4S'
			},
			{
				position: {x:3,y:1,z:0},
				orientation: Quaternion.fromXYZAxisAngle( 0,1,0, leMod(fn, this.framesPerSecond) * Math.PI*2 ),
				state: {},
				animationStartTime: 0.0,
				visualRef: 'urn:sha1:DND2P2W2AVQR3YFIXGA4MLQIZTFEPTC3'
			},
		];
		
		ctx.fillStyle = 'rgba(0,0,0,1)';
		ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);		
		
		const reso = 16;
		
		for( let e in entities ) {
			const entity = entities[e];
			const animTime = this.frameNumber/this.framesPerSecond - entity.animationStartTime;
			const imgSliceProm = this.imageManager.fetchVisualImageSlice(entity.visualRef, entity.state, animTime, Quaternion.IDENTITY, reso);
			
			this.ifResolvedThen( imgSliceProm, (slice:ImageSlice<HTMLImageElement>) => {
				const ctx2 = this.canvas.getContext('2d');
				if( ctx2 == undefined ) return Promise.reject(new Error("No 2d context"));
				ctx2.drawImage(slice.sheet, reso*entity.position.x-slice.origin.x, reso*entity.position.y-slice.origin.y);
				return Promise.resolve();
			}, (err) => {
				console.error("Failed to fetch visual image slice", err);
			});
		}
	}
	
	public run():void {
		dat.initData(this.gameDataManager).then( () => {
			setInterval( () => {
				++this.frameNumber;
				this.drawFrame();
			}, 1000/this.framesPerSecond );
		});
	}
}

export function buildDemo(canv:HTMLCanvasElement) {
	return new RenderDemo(canv);
}
