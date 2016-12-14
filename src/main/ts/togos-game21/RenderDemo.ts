import Quaternion from './Quaternion';
import Datastore from './Datastore';
import MemoryDatastore from './MemoryDatastore';
import GameDataManager from './GameDataManager';
import { VisualImageManager } from './rendering';
import { DEFAULT_LIGHTS } from './lights';
import { DEFAULT_MATERIAL_PALETTE } from './surfacematerials';
import * as dat from './maze1demodata'
import { isResolved } from './promises';

function sleep(interval:number):Promise<void> {
	return new Promise<void>( (resolve,reject) => {
		setTimeout(resolve, interval);
	});
}

function leMod( num:number, modBy:number ) {
	return num - modBy*Math.floor(num / modBy);
}

export class RenderDemo {
	protected gameDataManager:GameDataManager;
	protected datastore:Datastore<Uint8Array>;
	protected imageManager:VisualImageManager;
	
	public constructor(protected canvas:HTMLCanvasElement) {
		this.datastore = MemoryDatastore.createSha1Based(0);
		this.gameDataManager = new GameDataManager(this.datastore);
		this.imageManager = new VisualImageManager({
			lights: DEFAULT_LIGHTS,
			materialRefs: DEFAULT_MATERIAL_PALETTE,
			dictionaryRootRef: "xxx",
		}, this.gameDataManager);
	}
	
	protected frameNumber:number = 0;
	
	protected drawFrame() {
		const ctx = this.canvas.getContext('2d');
		if( ctx == null ) {
			console.error("No 2d context");
			return;
		}
		
		const fn = this.frameNumber;
		
		const orientation:Quaternion = Quaternion.fromXYZAxisAngle( 1,1,0, leMod(fn, 16) * Math.PI*2 );
		const entityState = {
			switchState: leMod(this.frameNumber, 14) < 7
		};
		
		ctx.fillStyle = 'rgba(0,0,0,1)';
		ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
		
		const imgSliceProm = this.imageManager.fetchVisualImageSlice(dat.wiredToggleBoxVisualRef, entityState, 0, Quaternion.IDENTITY, 16); 
		/* if( isResolved(imgSliceProm) ) {
			console.log("Pre-resolved promise, woo!");
		} else {
			console.log("Not pre-resolved ;(");
		} */
		
		imgSliceProm.then( (slice) => {
			if( fn != this.frameNumber ) {
				console.log("Image got, but too late for frame "+fn);				
			}
			const ctx2 = this.canvas.getContext('2d');
			if( ctx2 == undefined ) return Promise.reject(new Error("No 2d context"));
			ctx2.drawImage(slice.sheet, 0, 0);
			return Promise.resolve();
		}).catch( (err) => {
			console.error("Failed to fetch visual image slice", err);
		});
	}
	
	public run():void {
		dat.initData(this.gameDataManager).then( () => {
			setInterval( () => {
				++this.frameNumber;
				this.drawFrame();
			}, 100 );
		});
	}
}

export function buildDemo(canv:HTMLCanvasElement) {
	return new RenderDemo(canv);
}
