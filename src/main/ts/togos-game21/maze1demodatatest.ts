import MemoryDatastore from './MemoryDatastore';
import GameDataManager from './GameDataManager';
import { initData } from './maze1demodata';
import { registerTestResult } from './testing';

registerTestResult('initData returns', new Promise( (resolve,reject) => {
	const ds = MemoryDatastore.createSha1Based(0);
	const gdm = new GameDataManager(ds);
	return initData(gdm).then( () => {
		return {}; // Woo it's all good!
	});
}));
