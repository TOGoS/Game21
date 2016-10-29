///<reference path="../Promise.d.ts"/>

import { deepFreeze, thaw } from './DeepFreezer';
import Datastore from './Datastore';
import MemoryDatastore from './MemoryDatastore';
import KeyedList from './KeyedList';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import { utf8Encode } from '../tshash/utils';
import { identifyObject, fetchObject, storeObject, fastStoreObject } from './JSONObjectDatastore';
import { shortcutThen, value as promiseValue } from './promises';
import { Room, RoomEntity, Entity, EntityClass, StructureType, TileTree, TileEntityPalette, TileEntity } from './world';

const refKeyRegex = /.*Ref$/;
const hashUrnRegex = /^urn:(sha1|bitprint):.*/;

function isHashUrn( urn:string ):boolean {
	return hashUrnRegex.exec(urn) != null;
}

function assertNameNotHashUrn( name:string ) {
	if( isHashUrn(name) ) {
		throw new Error("Name for object is a hash URN, which is probably a bad idea! "+name);
	}
}

export default class GameDataManager {
	protected objectMapManager: DistributedBucketMapManager<string>;
	protected objectCache: KeyedList<any> = {};
	protected knownStored: KeyedList<string> = {};
	/**
	 * Stuff we're currently storing.
	 * Generally we don't want to let stuff fall out of the cache
	 * if we're still storing it, since that could result in fetch
	 * returning an outdated value!
	 */
	protected storing: KeyedList<boolean> = {};
	protected fetching: KeyedList<Promise<any>> = {};
	
	protected mutableObjects: KeyedList<any> = {};
	/**
	 * Immutable URNs of objects that have been 'temp stored'
	 * and should be saved to the backing datastore on flushUpdates
	 * if they are still referenced from the root nodes.
	 */
	protected tempObjectUrns:KeyedList<string> = {};
	/** Name => data name mappings that haven't yet been saved */
	protected tempNameMap:KeyedList<string|undefined> = {};
	
	public constructor( protected datastore:Datastore<Uint8Array>, rootNodeUri?:string ) {
		this.objectMapManager = new DistributedBucketMapManager<string>(this.datastore, rootNodeUri);
	}
	
	public get rootMapNodeUri():string { return this.objectMapManager.rootNodeUri; }
	
	public fetchTranslation( name:string ):Promise<string> {
		if( this.tempNameMap[name] ) return Promise.resolve(this.tempNameMap[name]);
		return this.objectMapManager.fetchValue(name).then( (hardRef:string|undefined) => {
			if( hardRef == undefined ) {
				return Promise.reject("No mapping found for "+name);
			}
			return hardRef;
		})
	}
	
	public getObjectIfLoaded<T>( ref:string, initiateFetch:boolean=false ):T|undefined {
		let v = this.mutableObjects[ref];
		if( v == null ) v = this.objectCache[ref];
		if( v == null && initiateFetch && !this.fetching[ref] ) this.fetchObject(ref);
		return v;
	}
	
	public getMutableObject<T>( ref:string ):T {
		if( this.mutableObjects[ref] ) return this.mutableObjects[ref];
		throw new Error(ref+" not in mutable object store");
	}
	
	public getObject<T>( ref:string ):T {
		const v = this.getObjectIfLoaded<T>(ref, true);
		if( v == null ) throw new Error(ref+" not loaded");
		return v;
	}
	
	public putMutableObject<T>( ref:string, obj:T ):void {
		// Make sure it's not also in the regular cache!
		delete this.objectCache[ref];
		this.mutableObjects[ref] = obj;
	}
	
	public getMutableRoom( roomId:string ):Room {
		if( this.mutableObjects[roomId] ) return this.mutableObjects[roomId];
		
		let room = this.getRoom(roomId);
		
		// Apparently deepThaw doesn't quite work, yet
		room = thaw(room);
		room.roomEntities = thaw(room.roomEntities);
		for( let re in room.roomEntities ) {
			room.roomEntities[re] = thaw(room.roomEntities[re]);
			room.roomEntities[re].entity = thaw(room.roomEntities[re].entity);
		}
		room.neighbors = thaw(room.neighbors);
		for( let n in room.neighbors ) {
			room.neighbors[n] = thaw(room.neighbors[n]);
		}
		this.putMutableObject( roomId, room );
		return room;
	}
	
	public getRoom( ref:string ):Room { return this.getObject<Room>(ref); }
	public getEntityClass( ref:string ):EntityClass { return this.getObject<EntityClass>(ref); }
	
	protected cache<T>( k:string, v:T ):void {
		this.objectCache[k] = v;
	}
	
	public fetchObject<T>( ref:string ):Promise<T> {
		if( ref == null ) throw new Error("Null ref passed to fetchObject");
		if( this.objectCache[ref] ) return Promise.resolve(this.objectCache[ref]);
		if( this.fetching[ref] ) return this.fetching[ref];
		
		if( isHashUrn(ref) ) {
			return this.fetching[ref] = fetchObject(ref, this.datastore, true).then( (v:any) => {
				this.cache(ref, v);
				this.knownStored[ref] = ref;
				delete this.fetching[ref];
				return <T>v;
			});
		} else {
			return this.fetching[ref] = this.fetchTranslation(ref).then( (realRef:string) => {
				return this.fetchObject(realRef).then( (v:any) => {
					this.cache(ref, v);
					delete this.fetching[ref];
					return <T>v;
				});
			});
		}
	}
	
	protected objectsToSave:KeyedList<any> = {};
	protected collected:KeyedList<string> = {};
	
	protected _collectLiveObjectsForSaving(obj:any) {
		for( let k in obj ) {
			const v = obj[k];
			if( v == null ) {
			} if( typeof v == 'string' ) {
				if( refKeyRegex.exec(k) ) {
					this.collectLiveObjectsForSaving(v);
				}
			} else if( typeof v == 'object' ) {
				this._collectLiveObjectsForSaving(v);
			}
		}
	}
	
	protected collectLiveObjectsForSaving(ref:string) {
		if( this.collected[ref] ) return; // Already visited!
		
		this.collected[ref] = ref;
		if( isHashUrn(ref) && !this.tempObjectUrns[ref] ) {
			// Probably safe to assume that everything it references has also been saved,
			// so we don't need to recurse any further.
			return;
		}
		
		const obj = this.getObjectIfLoaded(ref);
		
		if( this.tempObjectUrns[ref] ) {
			if( obj == null ) {
				console.warn("Tried to walk temp object "+ref+" but it's not in the cache!")
				return;
			}
			this.objectsToSave[ref] = obj;
		}
		if( obj == null ) return;

		if( typeof obj == 'object' ) {
			this._collectLiveObjectsForSaving(obj);
		}
	}
	
	/**
	 * Returns a promise of the root data map URN
	 */
	public flushUpdates():Promise<string> {
		for( let k in this.mutableObjects ) {
			const obj = this.mutableObjects[k];
			this.tempStoreObject(obj, k);
		}
		for( let r in this.mutableObjects ) {
			this.collectLiveObjectsForSaving(r);
		}
		for( let name in this.tempNameMap ) {
			const urn = this.tempNameMap[name];
			if( urn ) this.collectLiveObjectsForSaving(urn);
		}
		// Any that should be saved have been collected
		this.tempObjectUrns = {};
		this.collected = {};
		
		const storePromises:Promise<string>[] = [];
		for( let _k in this.objectsToSave ) {
			const v = this.objectsToSave[_k];
			if( this.knownStored[_k] ) continue;
			const k = _k;
			storePromises.push(this.storeObject(v).then( (savedAs) => {
				if( savedAs !== k ) {
					// This would be a major problem!
					return Promise.reject(new Error("Temp-saved object "+k+" finally saved with different URN: "+savedAs));
				}
				this.knownStored[savedAs] = savedAs;
				return savedAs;
			}));
		}
		this.objectsToSave = {};
		
		this.objectMapManager.storeValues(this.tempNameMap);
		this.tempNameMap = {};
		
		const rootUrnPromise = this.objectMapManager.flushUpdates();
		storePromises.push(rootUrnPromise);
		return Promise.all(storePromises).then(() => rootUrnPromise);
	}
	
	/**
	 * Clears the cache.
	 * No data should ever be lost due to a cache clear (unless something has happened to the backing store).
	 */
	public clearCache() {
		const oldCache:KeyedList<any> = this.objectCache;
		const newCache:KeyedList<any> = {};
		for( let urn in this.tempObjectUrns ) {
			const tempObj = oldCache[urn];
			if( !tempObj ) {
				console.warn("Temp object "+urn+" isn't in the cache!");
			}
			newCache[urn] = tempObj;
		}
		this.objectCache = newCache;
		this.knownStored = {};
	}
	
	public updateMap( updates:KeyedList<string> ):Promise<string> {
		return this.objectMapManager.storeValues( updates );
	}
	
	public storeObject<T>( obj:T, _name?:string ):Promise<string> {
		obj = deepFreeze(obj);
		const urnProm = storeObject( obj, this.datastore ).then( (storedAs) => {
			this.knownStored[storedAs] = storedAs;
			return storedAs;
		});
		const name = _name; // Make it const so later references check out
		if( name ) {
			assertNameNotHashUrn(name);
			this.objectCache[name] = obj;
			this.storing[name] = true;
			return urnProm.then( (urn) => {
				return this.updateMap({[name]: urn}).then( (newMapUrn) => {
					delete this.storing[name];
					return urn;
				});
			});
		} else return urnProm;
	}
	
	public fastStoreObject<T>( obj:T, _name?:string ):string {
		obj = deepFreeze(obj);
		const urn = fastStoreObject( obj, this.datastore );
		this.objectCache[urn] = obj;
		// Uhm, how can we set this.storing[urn] and then have it get cleared, uhm
		const name = _name;
		if( name ) {
			assertNameNotHashUrn(name);
			this.objectCache[name] = obj;
			this.storing[name] = true;
			this.updateMap({[name]: urn}).then( (newMapUrn) => {
				delete this.storing[name];
			});
		}
		return urn;
	}
	
	/**
	 * Store the given object (and optionally a name mapping)
	 * in a local memory datastore without committing the data
	 * to the backing datastore.
	 * 
	 * Only data that is referenced by a name and 
	 */
	public tempStoreObject<T>( obj:T, _name?:string ):string {
		obj = deepFreeze(obj);
		const urn = identifyObject( obj, this.datastore.identify );
		this.objectCache[urn] = obj;
		this.tempObjectUrns[urn] = urn;
		if( _name ) {
			assertNameNotHashUrn(_name);
			this.objectCache[_name] = obj;
			this.tempNameMap[_name] = urn;
		}
		return urn;
	}
	
	protected fullyCacheTileEntityPalette( paletteRef:string ):Promise<TileEntityPalette> {
		return this.fetchObject<TileEntityPalette>(paletteRef).then( (tep:TileEntityPalette) => {
			const itemPromises:Promise<EntityClass>[] = [];
			for( let te in tep ) {
				const tileEntity = tep[te];
				if( !tileEntity ) continue;
				if( !tileEntity.entity.classRef ) return Promise.reject("Tile entity palette "+paletteRef+" entry "+te+" has no classRef: "+JSON.stringify(tileEntity, null, "\t"));
				itemPromises.push(this.fullyCacheEntityClass(tileEntity.entity.classRef));
			}
			return Promise.all(itemPromises).then( () => tep );
		});
	}
	
	public fullyCacheEntityClass( classRef:string ):Promise<EntityClass> {
		return this.fetchObject<EntityClass>( classRef ).then( (ec:EntityClass) => {
			const itemPromises:Promise<any>[] = [];
			switch( ec.structureType ) {
			case StructureType.INDIVIDUAL:
			case StructureType.NONE:
				break;
			case StructureType.TILE_TREE:
				const tt:TileTree = <TileTree>ec;
				if( !tt.childEntityPaletteRef ) return Promise.reject("TileTree has no childEntityPaletteRef: "+JSON.stringify(ec,null,"\t"));
				itemPromises.push(this.fullyCacheTileEntityPalette(tt.childEntityPaletteRef));
				break;
			default:
				console.warn("Unrecognized entity structure type: "+ec.structureType);
			}
			return Promise.all(itemPromises).then( () => ec );
		});
	}
	
	protected _fullyCacheEntity( entity:Entity, itemPromises:Promise<any>[] ):void  {
		itemPromises.push(this.fullyCacheEntityClass(entity.classRef));
		for( let ii in entity.maze1Inventory ) {
			this._fullyCacheEntity(entity.maze1Inventory[ii], itemPromises);
		}
	}
	
	public fullyCacheRoom( roomId:string ):Promise<Room> {
		return this.fetchObject<Room>( roomId ).then( (room:Room) => {
			const itemPromises:Promise<any>[] = [];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				this._fullyCacheEntity(roomEntity.entity, itemPromises);
			}
			return Promise.all(itemPromises).then( () => room );
		});
	}
}
