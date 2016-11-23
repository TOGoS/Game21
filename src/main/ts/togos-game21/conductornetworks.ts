import { ESSCR_CONDUCTOR_NETWORK, ConductorNetwork } from './EntitySubsystem';
import Vector3D from './Vector3D';
import { vectorsAreEqual, vectorsAreOpposite } from './vector3ds';
import { subtractVector, addVector, vectorLength } from './vector3dmath';
import Quaternion from './Quaternion';
import TransformationMatrix3D from './TransformationMatrix3D';
import { Entity } from './world';
import { getEntitySubsystems } from './worldutil';
import GameDataManager from './GameDataManager';
import { resolvedPromise } from './promises';
import { deepFreeze } from './DeepFreezer';

declare class Map<K,V> {
	get(k:K):V|undefined;
	has(k:K):boolean;
	set(k:K, v:V):Map<K,V>;
}

export class ConductorNetworkBuilder {
	public network:ConductorNetwork = {
		classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/ConductorNetwork",
		nodes: [],
		links: [],
		mediumRefs: [],
	}
		
	public addMediumRef( mRef:string ):number {
		for( let i=0; i<this.network.mediumRefs.length; ++i ) {
			if( this.network.mediumRefs[i] == mRef ) return i;
		}
		this.network.mediumRefs.push(mRef);
		return this.network.mediumRefs.length-1;
	}
	
	public addNode( pos:Vector3D, externallyFacing?:Vector3D ):number {
		const nodes = this.network.nodes;
		const matchIndexes:number[] = [];
		for( let i=0; i<nodes.length; ++i ) {
			const node = nodes[i];
			if( node == undefined ) continue;
			if( !vectorsAreEqual(node.position, pos) ) continue;
			if( externallyFacing ) {
				if( node.externallyFacing ) {
					if( vectorsAreOpposite(externallyFacing, node.externallyFacing) ) {
						// Joined and become internal!
						node.externallyFacing = undefined;
					} else {
						console.warn(
							"Failed to join conductor network nodes due to conflicting externallyFacing vectors",
							externallyFacing,
							node.externallyFacing
						);
						continue;
					}
				} else {
					node.externallyFacing = externallyFacing;
				}
			}
			// Otherwise leave externallyFacing alone.
			return i;
		}

		const index = this.network.nodes.length;
		this.network.nodes.push( {
			position: pos,
			externallyFacing,
			linkIndexes: [],
		});
		return index;
	}
	
	public link( node0Index:number, node1Index:number, linkProps:{
		mediumIndex?:number, mediumRef?:string, crossSectionalArea:number, length?:number
	} ) {
		const linkIndex = this.network.links.length;
		const node0 = this.network.nodes[node0Index];
		const node1 = this.network.nodes[node1Index];
		if( !node0 ) throw new Error("No node "+node0Index);
		if( !node1 ) throw new Error("No node "+node1Index);
		node0.linkIndexes.push(linkIndex);
		node1.linkIndexes.push(linkIndex);
		this.network.links.push({
			endpoint0Index: node0Index,
			endpoint1Index: node1Index,
			mediumIndex:
				linkProps.mediumIndex != undefined ? linkProps.mediumIndex :
				linkProps.mediumRef != undefined ? this.addMediumRef(linkProps.mediumRef) :
				this.addMediumRef("http://ns.nuke24.net/Game21/TransmissionMedia/Copper"),
			crossSectionalArea:
				linkProps.crossSectionalArea || 1/16384, /* 1/128m square */
			length: linkProps.length == undefined ? vectorLength(subtractVector(
				node0.position,
				node1.position,
			)) : linkProps.length
		});
	}
	
	/**
	 * Add another network into our existing one,
	 * merging nodes at the same position.
	 */
	public addNetwork( xf:TransformationMatrix3D, b:ConductorNetwork ) {
		const nodeIndexMap:number[] = [];
		const mediumIndexMap:number[] = [];
		for( let n=0; n<b.nodes.length; ++n ) {
			const node = b.nodes[n];
			if( node == undefined ) continue;
			const n0 = this.addNode(
				xf.multiplyVector(node.position),
				node.externallyFacing ? xf.multiplyVector(node.externallyFacing) : undefined
			);
			nodeIndexMap[n] = n0;
		}
		for( let m=0; m<b.mediumRefs.length; ++m ) {
			const mr = b.mediumRefs[m];
			if( mr == undefined ) continue;
			mediumIndexMap[m] = this.addMediumRef(mr);
		}
		for( let l=0; l<b.links.length; ++l ) {
			const link = b.links[l];
			if( link == undefined ) continue;
			const n0RemappedIndex = nodeIndexMap[link.endpoint0Index];
			const n1RemappedIndex = nodeIndexMap[link.endpoint1Index];
			if( n0RemappedIndex == null ) throw new Error("Link from consumed network references node0 "+link.endpoint0Index+" which somehow doesn't map to a node in the consuming network");
			if( n1RemappedIndex == null ) throw new Error("Link from consumed network references node1 "+link.endpoint1Index+" which somehow doesn't map to a node in the consuming network");
			this.link(
				n0RemappedIndex,
				n1RemappedIndex,
				{
					mediumIndex: mediumIndexMap[link.mediumIndex],
					crossSectionalArea: link.crossSectionalArea,
					length: link.length
				}
			);
		}
	}
}

// "x,y,z"
type VectorString = string;
interface ConductorEndpoint {
	nodeIndex : number;
	resistance : number; // integral along length of resistivity * length / area
}

export function mergeConductorNetworks( n0Pos:Vector3D, n0:ConductorNetwork, n1Pos:Vector3D, n1:ConductorNetwork ):ConductorNetwork {
	throw new Error("Not implemented yet");
}

export function getConductorNetwork( pos:Vector3D, entity:Entity, gdm:GameDataManager ):ConductorNetwork {
	const subsystems = getEntitySubsystems(entity, gdm);
	const subnetworks:ConductorNetwork[] = [];
	for( let ss in subsystems ) {
		const subsystem = subsystems[ss];
		switch( subsystem.classRef ) {
		case "http://ns.nuke24.net/Game21/EntitySubsystem/ConductorNetwork":
			subnetworks.push( subsystem );
			break;
		}
	}
	//eachSubEntity(pos, entity, gdm, (subEnt, subEntPos))
	throw new Error("Not implemented yet");
}

export function findConductorNetworkNodes( network:ConductorNetwork, pos:Vector3D, into:number[]=[] ):number[] {
	for( let i=0; i<network.nodes.length; ++i ) {
		const node = network.nodes[i];
		if( node == undefined ) continue;
		if( vectorsAreEqual(node.position, pos) ) {
			into.push(i);
		}
	}
	return into;
}

//const copperResistivity = 0.000000017; // Ohm meter (because ohm per distance-over-area)
export const approximateCopperResistivity = 9/4 * Math.pow(2, -27); // Close-ish round number

export function findConductorEndpoints( network:ConductorNetwork, startNodeIndexes:number[] ):ConductorEndpoint[] {
	const pathResistances:(number|undefined)[] = [];
	const visitQueue:number[] = [];
	const enqueuedAndUnvisited:(boolean|undefined)[] = [];
	for( let i=0; i<startNodeIndexes.length; ++i ) {
		visitQueue.push(startNodeIndexes[i]);
		pathResistances[startNodeIndexes[i]] = 0;
	}
	for( let i=0; i<visitQueue.length; ++i ) {
		const n = visitQueue[i];
		enqueuedAndUnvisited[n] = false;
		const node = network.nodes[n];
		if( node == undefined ) throw new Error("Null node in visit queue! Index = "+n);
		const pathResistance = pathResistances[n];
		for( let e=0; e<node.linkIndexes.length; ++e ) {
			const l = node.linkIndexes[e];
			const link = network.links[l];
			if( link == undefined ) throw new Error("Node "+n+" references nonexistent link "+l);
			const otherEndNodeIndex = link.endpoint0Index == n ? link.endpoint1Index : link.endpoint0Index;
			const linkResistance = approximateCopperResistivity * link.length / link.crossSectionalArea;
			if( otherEndNodeIndex == n ) continue;
			
			const nextPathResistance = pathResistance + linkResistance;
			// I don't care about calculating actual resistance in networks
			// with loops.  In this simulation, all electrons will take the single
			// least-resistant path.
			if(
				pathResistances[otherEndNodeIndex] != undefined &&
				pathResistances[otherEndNodeIndex] <= nextPathResistance
			) continue;
			
			pathResistances[otherEndNodeIndex] = nextPathResistance;
			if( !enqueuedAndUnvisited[otherEndNodeIndex] ) {
				visitQueue.push(otherEndNodeIndex);
				enqueuedAndUnvisited[otherEndNodeIndex] = true;
			}
		}
	}
	
	const endpoints:ConductorEndpoint[] = [];
	// Okay, paths with lowest resistance found!
	for( let n=0; n<pathResistances.length; ++n ) {
		const pathResistance = pathResistances[n];
		if( pathResistance == undefined ) continue; // Not connected!
		const node = network.nodes[n];
		if( node == undefined ) throw new Error("Path resistances entry references nonexistent node "+n);
		if( !node.externallyFacing ) continue; // Don't care!
		
		endpoints.push({
			nodeIndex: n,
			resistance: pathResistance
		});
	}
	return endpoints;
}

export function findConductorEndpointsFromPosition( network:ConductorNetwork, startPos:Vector3D ):ConductorEndpoint[] {
	return findConductorEndpoints(network, findConductorNetworkNodes(network, startPos));
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

class EntityConductorNetworkCache
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
