///<reference path="../Promise.d.ts"/>

import { deepFreeze, thaw } from './DeepFreezer';
import Datastore from './Datastore';
import MemoryDatastore from './MemoryDatastore';
import KeyedList from './KeyedList';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import { utf8Encode } from 'tshash/utils';
import { identifyObject, fetchObject, storeObject, fastStoreObject } from './JSONObjectDatastore';
import { resolvedPromise, resolveWrap, shortcutThen, value as promiseValue } from './promises';
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

function thawEntity(entity:Entity) {
	entity = thaw(entity);
	if( entity.subsystems ) {
		entity.subsystems = thaw(entity.subsystems);
		for( let isk in entity.subsystems ) {
			entity.subsystems[isk] = thaw(entity.subsystems[isk]);
		}
	}
	if( entity.maze1Inventory ) {
		entity.maze1Inventory = thaw(entity.maze1Inventory);
		for( let ik in entity.maze1Inventory ) {
			entity.maze1Inventory[ik] = thawEntity(entity.maze1Inventory[ik]);
		}
	}
	return entity;
}

type SoftRef = string;
type HardRef = string;
type Ref = string;
type Map<K extends string,V> = KeyedList<V>;
type Set<T extends string> = Map<T,boolean>; // Or could use booleans like the graphmaze/setutil

export default class GameDataManager {
	protected objectMapManager: DistributedBucketMapManager<string>;
	protected fullyCachedRooms: Set<HardRef> = {};
	/**
	 * Stuff that we know the backing datastore already has,
	 * either because that's where we got it from or because we put it there.
	 * When saving, we won't bother storing knownStored things again.
	 * This only makes sense for hard refs.
	 */
	protected knownStored: Set<HardRef> = {};
	/**
	 * Stuff we're currently storing.
	 * Generally we don't want to let stuff fall out of the cache
	 * if we're still storing it, since that could result in fetch
	 * returning an outdated value!
	 */
	protected storing: Set<Ref> = {};
	/**
	 * Promises of things that we are fetching or have fetched.
	 * Objects in here should be treated as immutable.
	 */
	protected cache: Map<Ref,Promise<any>> = {};
	/*
	 * Mutable objects.
	 * Anything in here should *not* be in cache.
	 */
	protected mutableObjects: Map<SoftRef,any> = {};
	
	/**
	 * Immutable URNs of objects that have been 'temp stored'
	 * and should be saved to the backing datastore on flushUpdates
	 * _if_ they are still referenced from the root nodes.
	 */
	protected tempObjectUrns:Set<HardRef> = {};
	/** Name => data name mappings that haven't yet been saved */
	protected tempNameMap:Map<SoftRef,HardRef|undefined> = {};
	
	public constructor( protected datastore:Datastore<Uint8Array>, rootNodeUri?:string ) {
		this.objectMapManager = new DistributedBucketMapManager<string>(this.datastore, rootNodeUri);
	}
	
	public get rootMapNodeUri():string { return this.objectMapManager.rootNodeUri; }
	
	public fetchHardRef( name:string ):Promise<string> {
		if( this.tempNameMap[name] ) return Promise.resolve(this.tempNameMap[name]);
		if( this.mutableObjects[name] ) return Promise.reject(new Error("No hard ref for "+name+" because it is currently loaded as mutable"));
		return this.objectMapManager.fetchValue(name).then( (hardRef:string|undefined) => {
			if( hardRef == undefined ) {
				return Promise.reject("No mapping found for "+name);
			}
			return hardRef;
		})
	}
	
	public getObjectIfLoaded<T>( ref:string, initiateFetch:boolean=false ):T|undefined {
		const v = this.mutableObjects[ref];
		if( v != null ) return v;
		
		const p = this.cache[ref];
		if( p ) return promiseValue(p);
		
		if( initiateFetch ) return promiseValue(this.fetchObject<T>(ref));
		
		return undefined;
	}
	
	public getMutableObject<T>( ref:string ):T {
		if( this.mutableObjects[ref] ) return this.mutableObjects[ref];
		throw new Error(ref+" not in mutable object store");
	}
	
	public getObject<T>( ref:string, initiateFetch:boolean=false ):T {
		const v = this.getObjectIfLoaded<T>(ref, initiateFetch);
		if( v == null ) throw new Error(ref+" not loaded");
		return v;
	}
	
	public putMutableObject<T>( ref:string, obj:T ):void {
		delete this.cache[ref];
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
			room.roomEntities[re].entity = thawEntity(room.roomEntities[re].entity);
		}
		room.neighbors = thaw(room.neighbors);
		for( let n in room.neighbors ) {
			room.neighbors[n] = thaw(room.neighbors[n]);
		}
		this.putMutableObject( roomId, room );
		return room;
	}
	
	public getRoom( ref:string ):Room { return this.getObject<Room>(ref); }
	public getEntityClass( ref:string, initiateFetch:boolean=false ):EntityClass { return this.getObject<EntityClass>(ref, initiateFetch); }
		
	public fetchObject<T>( ref:string ):Promise<T> {
		if( ref == null ) throw new Error("Null ref passed to fetchObject");
		if( this.cache[ref] ) return this.cache[ref];
		
		if( isHashUrn(ref) ) {
			return this.cache[ref] = resolveWrap(fetchObject(ref, this.datastore, true).then( (v:any) => {
				this.knownStored[ref] = true;
				return <T>v;
			}));
		} else {
			return this.cache[ref] = resolveWrap(this.fetchHardRef(ref).then( (realRef:string):Promise<T> => {
				return this.fetchObject(realRef);
			}));
		}
	}
	
	// Since this is cache 'objects', I think it should by default be recursive
	// for subject URNs (i.e. 'urn:sha1:BLAH#' should be recursive, 'urn:sha1:BLAH' should not be)
	public cacheObjects( refs:(string[]|KeyedList<string>) ):Promise<any> {
		const leRefs:any = refs; // Placate the TypeScript compiler.
		const fetchPromises:Promise<any>[] = [];
		for( let r in leRefs ) {
			fetchPromises.push(this.fetchObject(leRefs[r]));
		}
		return Promise.all(fetchPromises);
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
				this.knownStored[savedAs] = true;
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
		const oldCache:KeyedList<Promise<any>> = this.cache;
		const newCache:KeyedList<Promise<any>> = {};
		for( let urn in this.tempObjectUrns ) {
			const tempProm = oldCache[urn];
			if( !tempProm ) {
				console.warn("Temp object, '"+urn+"', isn't in the cache!");
			}
			newCache[urn] = tempProm;
		}
		for( let urn in this.storing ) {
			const savingProm = oldCache[urn];
			if( !savingProm ) console.error("Object being saved, '"+urn+"', not in the cache!");
			newCache[urn] = savingProm;
		}
		this.cache = newCache;
		this.knownStored = {};
		this.fullyCachedRooms = {};
	}
	
	public updateMap( updates:Map<SoftRef,HardRef> ):Promise<string> {
		for( let k in updates ) {
			// Any overrides are no longer valid!
			delete this.tempNameMap[k];
			delete this.cache[k];
			if( this.cache[updates[k]] ) {
				// If everything's already in memory, make sure immediate gets will still work.
				this.cache[k] = this.cache[updates[k]];
			}
		}
		return this.objectMapManager.storeValues( updates );
	}
	
	public storeObject<T>( obj:T, _name?:string ):Promise<string> {
		obj = deepFreeze(obj);
		const prom = resolvedPromise(obj);
		const name = _name; // Make it const so later references check out
		// If they gave it a name we can associate it with that right away!
		if( name ) {
			assertNameNotHashUrn(name);
			this.cache[name] = prom;
			this.storing[name] = true;
		}
		const urnProm = storeObject( obj, this.datastore ).then( (urn) => {
			this.cache[urn] = prom;
			this.knownStored[urn] = true;
			return urn;
		});
		return name ? urnProm.then( (urn) => {
			return this.updateMap({[name]: urn}).then( (newMapUrn) => {
				delete this.storing[name];
				return urn;
			});
		}) : urnProm;
	}
	
	public fastStoreObject<T>( obj:T, _name?:string ):string {
		obj = deepFreeze(obj);
		const prom = resolvedPromise(obj);
		const urn = fastStoreObject( obj, this.datastore );
		this.cache[urn] = prom;
		// Uhm, how can we set this.storing[urn] and then have it get cleared, uhm
		const name = _name;
		if( name ) {
			assertNameNotHashUrn(name);
			this.cache[name] = prom;
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
	 */
	public tempStoreObject<T>( obj:T, _name?:string ):string {
		obj = deepFreeze(obj);
		const urn = identifyObject( obj, this.datastore.identify );
		const prom = resolvedPromise(obj);
		this.cache[urn] = prom;
		this.tempObjectUrns[urn] = true;
		if( _name ) {
			assertNameNotHashUrn(_name);
			this.cache[_name] = prom;
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
		if( entity.maze1Inventory ) for( let ii in entity.maze1Inventory ) {
			this._fullyCacheEntity(entity.maze1Inventory[ii], itemPromises);
		}
	}
	
	public fullyCacheRoom( roomId:string ):Promise<Room> {
		// This assumes that a room has no changed to include something
		// that isn't cached.
		// But that's not the expected use case for this function, so whatever.
		// Could change it to only look at hard refs,
		// which decreases the likelihood of that use case further.
		if( this.fullyCachedRooms[roomId] ) return Promise.resolve(this.getRoom(roomId));
		
		return this.fetchObject<Room>( roomId ).then( (room:Room) => {
			const itemPromises:Promise<any>[] = [];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				this._fullyCacheEntity(roomEntity.entity, itemPromises);
			}
			return Promise.all(itemPromises).then( () => {
				this.fullyCachedRooms[roomId] = true;
				return room;
			});
		});
	}
}
