import Datastore from './Datastore';
import HTTPHashDatastore from './HTTPHashDatastore';

export default class ClientRegistry {
	public datastore : Datastore<Uint8Array>;
}

export function getDemoRegistry():ClientRegistry {
	const reg:ClientRegistry = new ClientRegistry();
	reg.datastore = HTTPHashDatastore.createDefault();
	return reg;
}
