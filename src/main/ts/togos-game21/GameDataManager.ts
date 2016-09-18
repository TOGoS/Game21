///<reference path="../Promise.d.ts"/>

import { deepFreeze } from './DeepFreezer';
import Datastore from './Datastore';
import KeyedList from './KeyedList';
import { DistributedBucketMapManager } from './DistributedBucketMap';
import { utf8Encode } from '../tshash/utils';
import { fetchObject, storeObject, fastStoreObject } from './JSONObjectDatastore';
import { shortcutThen, value as promiseValue } from './promises';
import { Room, RoomEntity, Entity, EntityClass, StructureType, TileTree, TileEntityPalette, TileTreeEntity } from './world';

const hashUrnRegex = /^urn:(sha1|bitprint):.*/;

export default class GameDataManager {
	protected objectMapManager: DistributedBucketMapManager<string>;
	protected datastore: Datastore<Uint8Array>;
	protected objectCache: KeyedList<any> = {};
	/**
	 * Stuff we're currently storing.
	 * Generally we don't want to let stuff fall out of the cache
	 * if we're still storing it, since that could result in fetch
	 * returning an outdated value!
	 */
	protected storing: KeyedList<boolean> = {};
	protected fetching: KeyedList<Promise<any>> = {};
	
	public constructor( ds:Datastore<Uint8Array>, omm:DistributedBucketMapManager<string> ) {
		this.datastore = ds;
		this.objectMapManager = omm;
	}
	
	public getObjectIfLoaded<T>( ref:string, initiateFetch:boolean=false ):T|undefined {
		const v = this.objectCache[ref];
		if( v == null && initiateFetch && !this.fetching[ref] ) this.fetchObject(ref);
		return v;
	}
	public getObject<T>( ref:string, initiateFetch:boolean=false ):T {
		const v = this.getObjectIfLoaded<T>(ref, initiateFetch);
		if( v == null ) throw new Error(ref+" not loaded");
		return v;
	}

	public getRoom( ref:string ):Room { return this.getObject<Room>(ref); }
	public getEntityClass( ref:string ):EntityClass { return this.getObject<EntityClass>(ref); }
	
	protected cache<T>( k:string, v:T ):void {
		this.objectCache[k] = v;
	}
	
	public fetchObject<T>( ref:string ):Promise<T> {
		if( this.objectCache[ref] ) return Promise.resolve(this.objectCache[ref]);
		if( this.fetching[ref] ) return this.fetching[ref];
		
		if( hashUrnRegex.exec(ref) ) {
			return this.fetching[ref] = fetchObject(ref, this.datastore, true).then( (v:any) => {
				this.cache(ref, v);
				delete this.fetching[ref];
				return <T>v;
			});
		} else {
			return this.fetching[ref] = this.objectMapManager.fetchValue(ref).then( (realRef:string) => {
				if( realRef == null ) {
					return Promise.reject("No mapping for "+ref);
				} else {
					return this.fetchObject(realRef).then( (v:any) => {
						this.cache(ref, v);
						delete this.fetching[ref];
						return <T>v;
					});
				}
			});
		}
	}
	
	public clearCache():void {
		// Well, might not want to clear stuff out that we're in the process of storing.
		// But maybe we do if explicitly asked to clearCache().  *shrug*
		this.objectCache = {};
	}
	
	protected updateMap( updates:KeyedList<string> ):Promise<string> {
		return this.objectMapManager.storeValues( updates );
	}
	
	public storeObject( obj:any, _name?:string ):Promise<string> {
		obj = deepFreeze(obj);
		const urnProm = storeObject( obj, this.datastore );
		const name = _name; // Make it const so later references check out
		if( name ) {
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
			this.objectCache[name] = obj;
			this.storing[name] = true;
			this.updateMap({[name]: urn}).then( (newMapUrn) => {
				delete this.storing[name];
			});
		}
		return urn;
	}

	protected fullyLoadTileEntityPalette( paletteRef:string ):Promise<TileEntityPalette> {
		return this.fetchObject<TileEntityPalette>(paletteRef).then( (tep:TileEntityPalette) => {
			const itemPromises:Promise<EntityClass>[] = [];
			for( let te in tep ) {
				const tileEntity = tep[te];
				if( tileEntity ) itemPromises.push(this.fullyLoadEntityClass(tileEntity.entity.classRef));
			}
			return Promise.all(itemPromises).then( () => tep );
		});
	}

	public fullyLoadEntityClass( classRef:string ):Promise<EntityClass> {
		return this.fetchObject<EntityClass>( classRef ).then( (ec:EntityClass) => {
			const itemPromises:Promise<any>[] = [];
			switch( ec.structureType ) {
			case StructureType.INDIVIDUAL:
			case StructureType.NONE:
				break;
			case StructureType.TILE_TREE:
				const tt:TileTree = <TileTree>ec;
				itemPromises.push(this.fullyLoadTileEntityPalette(tt.childEntityPaletteRef));
			}
			return Promise.all(itemPromises).then( () => ec );
		})
	}

	public fullyLoadRoom( roomId:string ):Promise<Room> {
		return this.fetchObject<Room>( roomId ).then( (room:Room) => {
			const itemPromises:Promise<EntityClass>[] = [];
			for( let re in room.roomEntities ) {
				const roomEntity = room.roomEntities[re];
				itemPromises.push(this.fullyLoadEntityClass(roomEntity.entity.classRef));
			}
			return Promise.all(itemPromises).then( () => room );
		})
	}
}
