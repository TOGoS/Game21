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

export class RenderDemo {
	protected gameDataManager:GameDataManager;
	protected datastore:Datastore<Uint8Array>;
	
	public constructor(protected canvas:HTMLCanvasElement) {
		this.datastore = MemoryDatastore.createSha1Based(0);
		this.gameDataManager = new GameDataManager(this.datastore);
	}
	
	public run():void {
		const ctx = this.canvas.getContext('2d');
		if( ctx == null ) throw new Error("No 2d context");
		ctx.fillStyle = 'rgba(255,255,0,1)';
		ctx.fillRect(0,0,1,1);
		
		const imageCache = new VisualImageManager({
			lights: DEFAULT_LIGHTS,
			materialRefs: DEFAULT_MATERIAL_PALETTE,
			dictionaryRootRef: "xxx",
		}, this.gameDataManager);
		
		{
			const imgSliceProm = imageCache.fetchVisualImageSlice(dat.greenToggleBoxOnImgRef, {}, 0, Quaternion.IDENTITY, 16); 
			if( isResolved(imgSliceProm) ) {
				console.log("Pre-resolved promise, woo!");
			} else {
				console.log("Not pre-resolved ;(");
			}
			
			imgSliceProm.then( (slice) => {
				console.log("Image got, drawing!", slice.sheetRef);
				const ctx2 = this.canvas.getContext('2d');
				if( ctx2 == undefined ) return Promise.reject(new Error("No 2d context"));
				ctx2.drawImage(slice.sheet, 0, 0);
				return Promise.resolve();
			}).catch( (err) => {
				console.error("Failed to fetch visual image slice", err);
			});
		}
		
		sleep(10).then( () => {
			console.log("Sleeping for a bit...");
		}).then( () => sleep(100) ).then( () => {
			console.log("FETCHING AGAIN!");
			const imgSliceProm = imageCache.fetchVisualImageSlice(dat.greenToggleBoxOnImgRef, {}, 0, Quaternion.IDENTITY, 16); 
			if( isResolved(imgSliceProm) ) {
				console.log("Pre-resolved promise, woo!");
			} else {
				console.log("Not pre-resolved ;(");
			}
			
			imgSliceProm.then( (slice) => {
				console.log("Image got, drawing!", slice.sheetRef);
				const ctx2 = this.canvas.getContext('2d');
				if( ctx2 == undefined ) return Promise.reject(new Error("No 2d context"));
				ctx2.drawImage(slice.sheet, 16, 0);
				return Promise.resolve();
			}).catch( (err) => {
				console.error("Failed to fetch visual image slice", err);
			});
		})
	}
}

export function buildDemo(canv:HTMLCanvasElement) {
	return new RenderDemo(canv);
}
