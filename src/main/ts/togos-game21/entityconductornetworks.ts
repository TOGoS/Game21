import { ESSCR_CONDUCTOR_NETWORK, ConductorNetwork } from './EntitySubsystem';
import Vector3D from './Vector3D';
import { vectorsAreEqual, vectorsAreOpposite } from './vector3ds';
import { subtractVector, addVector, vectorLength } from './vector3dmath';
import Quaternion from './Quaternion';
import TransformationMatrix3D from './TransformationMatrix3D';
import { resolvedPromise } from './promises';
import { deepFreeze } from './DeepFreezer';

import { ConductorNetworkBuilder, ConductorEndpoint } from './conductornetworks';

import { Entity } from './world';
import { getEntitySubsystems } from './worldutil';
import GameDataManager from './GameDataManager';

declare class Map<K,V> {
	get(k:K):V|undefined;
	has(k:K):boolean;
	set(k:K, v:V):Map<K,V>;
}

interface Placed<X> {
	position : Vector3D;
	orientation : Quaternion;
	item : X;
}

interface WorldConductorNetworkEndpoints {
	network : ConductorNetwork;
	endpoints : ConductorEndpoint[];
}

export class EntityConductorNetworkCache
{
	public constructor(protected gameDataManager:GameDataManager) { }
	
	protected entityClassNetworkPromiseCache = new Map<string,Promise<ConductorNetwork>>();
	
	public fetchEntityClassConductorNetwork( classRef:string ):Promise<ConductorNetwork> {
		const cachedNetworkPromise = this.entityClassNetworkPromiseCache.get(classRef);
		if( cachedNetworkPromise ) return cachedNetworkPromise;
		
		const aggregator = new ConductorNetworkAggregator(this);
		const prom = aggregator.addEntityNetworks( TransformationMatrix3D.IDENTITY, {classRef} ).then( () => {
			return aggregator.network;
		});
		this.entityClassNetworkPromiseCache.set(classRef, prom);
		return prom;
	}
	
	public fetchEntityConductorNetwork( entity:Entity ):Promise<ConductorNetwork> {
		if( entity.subsystems ) {
			// Need to make sure they're not overriding any of the defaults
			for( let ssk in entity.subsystems ) {
				const ss = entity.subsystems[ssk];
				if( ss == null || ss.classRef == ESSCR_CONDUCTOR_NETWORK ) {
					// Might be overriding...
					throw new Error("Entity instance overrides of conductor networks not yet supported");
				}
			}
		}
		return this.fetchEntityClassConductorNetwork( entity.classRef );
	}
}

class ConductorNetworkAggregator {
	protected builder:ConductorNetworkBuilder;
	public constructor( protected EntityConductorNetworkCache:EntityConductorNetworkCache ) {
		this.builder = new ConductorNetworkBuilder();
	}
	public addEntityNetworks( xf:TransformationMatrix3D, entity:Entity ):Promise<this> {
		throw new Error('Not yet implemented');
	}
	public get network():ConductorNetwork {
		return deepFreeze(this.builder.network);
	}
}

/*
function getEntityClassConductorEndpoints(
	gdm:GameDataManager, classRef:string, startPos:Vector3D, startDir:Vector3D, into:Placed<WorldConductorNetworkEndpoints>[]=[]
):Placed<WorldConductorNetworkEndpoints>[] {
	// TODO: cache result base on hard reference to class
	
	const entityClass = gdm.getEntityClass(classRef);
	if( entityClass.defaultSubsystems ) {
		
	}
	const bb = 
}
*/

export function getWorldConductorEndpoints( gdm:GameDataManager, roomId:string, pos:Vector3D, dir:Vector3D ):Placed<ConductorNetwork>[] {
	const room = gdm.getRoom(roomId);
	const networkBuilder = new ConductorNetworkBuilder();
	for( let re in room.roomEntities ) {
		const roomEntity = room.roomEntities[re];
		let hasCustomConductorNetworks = false;
		if( roomEntity.entity.subsystems ) for( let ssk in roomEntity.entity.subsystems ) {
			const ss = roomEntity.entity.subsystems[ssk];
			if( ss == null ) {
				// TODO: Only if the thing overridden
				// was a conductor network
			} else if( ss.classRef == ESSCR_CONDUCTOR_NETWORK ) {
				hasCustomConductorNetworks = true;
			}
		}
		if( hasCustomConductorNetworks ) {
			throw new Error('Oh no, entity has custom conductor networks.');
		}
		// TODO:
	}
	throw new Error("This doesn't work yet");
}

/*
export function findConductorEndpointsFromWorldPosition( gdm:GameDataManager, roomId:string, pos:Vector3D, direction:Vector3D ) {
	const networks = getWorldConductorNetworks(gdm, roomId, pos, direction);
}
*/
