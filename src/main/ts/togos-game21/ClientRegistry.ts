import Datastore from './Datastore.ts';
import HTTPHashDatastore from './HTTPHashDatastore.ts';

export default class ClientRegistry {
	public datastore : Datastore<Uint8Array>;
}

export function getDemoRegistry():ClientRegistry {
	const reg:ClientRegistry = new ClientRegistry();
	reg.datastore = HTTPHashDatastore.createDefault();
	return reg;
}
