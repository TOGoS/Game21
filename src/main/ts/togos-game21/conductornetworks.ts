import { ConductorNetwork } from './EntitySubsystem';
import Vector3D from './Vector3D';
import { vectorsAreEqual } from './vector3ds';
import { subtractVector, addVector, vectorLength } from './vector3dmath';
import { Entity } from './world';
import { getEntitySubsystems } from './worldutil';
import GameDataManager from './GameDataManager';

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
	
	protected nodeIndexesByPosition = new Map<Vector3D,number>();
	
	public addMediumRef( mRef:string ) {
		for( let i=0; i<this.network.mediumRefs.length; ++i ) {
			if( this.network.mediumRefs[i] == mRef ) return i;
		}
		this.network.mediumRefs.push(mRef);
		return this.network.mediumRefs.length-1;
	}
	
	public addNode( pos:Vector3D, isExternal:boolean, internalizeReUsed:boolean=false ) {
		let index = this.nodeIndexesByPosition.get(pos);
		if( index != undefined ) {
			const node = this.network.nodes[index];
			if( internalizeReUsed ) {
				node.isExternal = false;
			} else if( isExternal ) {
				node.isExternal = true;
			}
			return index;
		}
		
		index = this.network.nodes.length;
		this.network.nodes.push( {
			position: pos,
			isExternal,
			linkIndexes: [],
		});
		this.nodeIndexesByPosition.set(pos, index);
		return index;
	}
	
	public link( node0Index:number, node1Index:number, linkProps:{
		mediumIndex?:number, mediumRef?:string, crossSectionalArea:number, length?:number
	} ) {
		const linkIndex = this.network.links.length;
		if( !this.network.nodes[node0Index] ) throw new Error("No node "+node0Index);
		if( !this.network.nodes[node1Index] ) throw new Error("No node "+node1Index);
		this.network.nodes[node0Index].linkIndexes.push(linkIndex);
		this.network.nodes[node1Index].linkIndexes.push(linkIndex);
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
				this.network.nodes[node0Index].position,
				this.network.nodes[node1Index].position,
			)) : linkProps.length
		});
	}
	
	/**
	 * Add another network into our existing one,
	 * merging nodes at the same position.
	 */
	public addNetwork( b:ConductorNetwork, pos:Vector3D ) {
		const nodeIndexMap:number[] = [];
		const mediumIndexMap:number[] = [];
		for( let n=0; n<b.nodes.length; ++n ) {
			const node = b.nodes[n];
			const n0 = this.addNode(addVector(pos, node.position), node.isExternal, true);
			nodeIndexMap[n] = n0;
		}
		for( let m=0; m<b.mediumRefs.length; ++m ) {
			mediumIndexMap[m] = this.addMediumRef(b.mediumRefs[m]);
		}
		for( let l=0; l<b.links.length; ++l ) {
			const link = b.links[l];
			this.link(
				nodeIndexMap[link.endpoint0Index],
				nodeIndexMap[link.endpoint1Index],
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
		if( vectorsAreEqual(node.position, pos) ) {
			into.push(i);
		}
	}
	return into;
}

//const copperResistivity = 0.000000017; // Ohm meter (because ohm per distance-over-area)
const approximateCopperResistivity = 9/4 * Math.pow(2, -27); 

export function findConductorEndpoints( network:ConductorNetwork, startPos:Vector3D ):ConductorEndpoint[] {
	const pathResistances:(number|undefined)[] = [];
	const visitQueue:number[] = [];
	const enqueuedAndUnvisited:(boolean|undefined)[] = [];
	findConductorNetworkNodes(network, startPos, visitQueue);
	for( let i=0; i<visitQueue.length; ++i ) {
		pathResistances[i] = 0;
	}
	for( let i=0; i<visitQueue.length; ++i ) {
		const n = visitQueue[i];
		enqueuedAndUnvisited[n] = false;
		const node = network.nodes[n];
		const pathResistance = pathResistances[n];
		for( let e in node.linkIndexes ) {
			const l = node.linkIndexes[e];
			const link = network.links[l];
			const otherEndNodeIndex = link.endpoint0Index == n ? link.endpoint1Index : link.endpoint0Index;
			const linkResistance = approximateCopperResistivity * link.length / link.crossSectionalArea;
			if( otherEndNodeIndex == n ) continue;
			
			const nextPathResistance = pathResistance + linkResistance;
			// I don't care about calculating actual resistance in networks
			// with loops.  In this simulation, all electrons will take the single
			// least-resistant path.
			if(
				pathResistances[otherEndNodeIndex] == undefined ||
				pathResistances[otherEndNodeIndex] < nextPathResistance
			)
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
		if( pathResistances[n] == undefined ) continue; // Not connected!
		const node = network.nodes[n];
		if( !node.isExternal ) continue; // Don't care!
		
		endpoints.push({
			nodeIndex: n,
			resistance: pathResistances[n]
		});
	}
	return endpoints;
}
