import Datastore from './Datastore';
import HTTPHashDatastore from './HTTPHashDatastore';

export default class ClientRegistry {
	public datastore : Datastore<Uint8Array>;
}

export function getDemoRegistry():ClientRegistry {
	const reg:ClientRegistry = new ClientRegistry();
	reg.datastore = new HTTPHashDatastore("http://game21-data.nuke24.net/uri-res/N2R");
	return reg;
}
