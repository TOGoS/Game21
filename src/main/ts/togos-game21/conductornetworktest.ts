import {
	ConductorNetworkBuilder,
	findConductorEndpointsFromPosition, findConductorNetworkNodes, findConductorEndpoints,
	approximateCopperResistivity
} from './conductornetworks';
import { TestResult, registerTestResult } from './testing';
import { addVector } from './vector3dmath';
import TransformationMatrix3D from './TransformationMatrix3D';

export const RIGHT_X  = +0.5;
export const LEFT_X   = -0.5;
export const TOP_Y    = -0.5;
export const BOTTOM_Y = +0.5;

export const STD_ETH_X = -3/16;
export const STD_ETH_Y = -3/16;
export const STD_ETH_Z = +5/16;

export const STD_WIRE_CSAREA = 1/(128*128);
export const STD_WIRE_LENGTH = 1;

/*

 +-+-+-+-+-+-+-+-+-+-X-+-+-+-+-+-+
 |               |   |           |
 |   X===========X===X           |
 |   |           |               |
 |   |           |               |
 |   |           |               |
 |   |           |               |
 |   |           |               |
 |   |           |               |
 +-+-X-+-+-+-+-+-+-+-+-+-+-+-+-+-+

*/

export const RIGHT_NODE_POS  = {x:RIGHT_X  , y:STD_ETH_Y, z:STD_ETH_Z};
export const BOTTOM_NODE_POS = {x:STD_ETH_X, y:BOTTOM_Y , z:STD_ETH_Z};
export const LEFT_NODE_POS   = {x:LEFT_X   , y:STD_ETH_Y, z:STD_ETH_Z};
export const TOP_NODE_POS    = {x:STD_ETH_X, y:TOP_Y    , z:STD_ETH_Z};
export const MID_NODE_POS    = {x:STD_ETH_X, y:STD_ETH_Y, z:STD_ETH_Z};

export const networkA = (() => {
	const builder = new ConductorNetworkBuilder();
	
	const bottomNodeIdx = builder.addNode(BOTTOM_NODE_POS, {x:0,y:+1,z:0});
	const rightNodeIdx  = builder.addNode(RIGHT_NODE_POS , {x:+1,y:0,z:0});
	const midNodeIdx    = builder.addNode(MID_NODE_POS   );
	
	builder.link( bottomNodeIdx, midNodeIdx, {
		crossSectionalArea: STD_WIRE_CSAREA,
		length: STD_WIRE_LENGTH,
	});
	builder.link( rightNodeIdx, midNodeIdx, {
		crossSectionalArea: STD_WIRE_CSAREA,
		length: STD_WIRE_LENGTH,
	});
	
	return builder.network;
})();

export const networkB = (() => {
	const builder = new ConductorNetworkBuilder();
	
	const topNodeIdx    = builder.addNode(TOP_NODE_POS , {x:0,y:-1,z:0});
	const leftNodeIdx   = builder.addNode(LEFT_NODE_POS, {x:-1,y:0,z:0});
	const midNodeIdx    = builder.addNode(MID_NODE_POS   );
	
	builder.link( topNodeIdx, midNodeIdx, {
		crossSectionalArea: STD_WIRE_CSAREA,
		length: STD_WIRE_LENGTH,
	});
	builder.link( leftNodeIdx, midNodeIdx, {
		crossSectionalArea: STD_WIRE_CSAREA,
		length: STD_WIRE_LENGTH,
	});
	
	return builder.network;
})();

export const networkAB = (() => {
	const aggregateBuilder = new ConductorNetworkBuilder();
	aggregateBuilder.addNetwork(TransformationMatrix3D.translationXYZ(-0.5,0,0), networkA);
	aggregateBuilder.addNetwork(TransformationMatrix3D.translationXYZ(+0.5,0,0), networkB);
	return aggregateBuilder.network;
})();

registerTestResult( "findConductorEndpoints", new Promise<TestResult>( (resolve,reject) => {
	const bottomNodeIndexes = findConductorNetworkNodes(networkA, BOTTOM_NODE_POS);
	const rightNodeIndexes = findConductorNetworkNodes(networkA, RIGHT_NODE_POS);
	const foundEndpoints = findConductorEndpoints( networkA, bottomNodeIndexes );
	const expectedResistance = approximateCopperResistivity * STD_WIRE_LENGTH*2 / STD_WIRE_CSAREA;
	
	if( foundEndpoints.length != 2 ) {
		return reject(new Error("Expected to find 2 endpoints, but found only "+JSON.stringify(foundEndpoints)));
	}
	
	for( let i=0; i<foundEndpoints.length; ++i ) {
		if( bottomNodeIndexes.indexOf(foundEndpoints[i].nodeIndex) >= 0 ) {
			if( foundEndpoints[i].resistance != 0 ) {
				return reject(new Error("Start node resistance not zero! "+JSON.stringify(foundEndpoints)));
			}
		} else {
			if( rightNodeIndexes.indexOf(foundEndpoints[i].nodeIndex) == -1 ) {
				return reject(new Error("Expected non-start node to be #"+rightNodeIndexes.join(',')+"; "+JSON.stringify(foundEndpoints)));
			}
			if( foundEndpoints[i].resistance != expectedResistance ) {
				return reject(new Error("Expected resistance of network to be "+expectedResistance+"; "+JSON.stringify(foundEndpoints)));
			}
		}
	}
	
	return resolve({});
}));

registerTestResult( "joinConductorNetworks", new Promise<TestResult>( (resolve,reject) => {
	if( networkAB.nodes.length != 5 ) {
		console.error("Joined network nodes:", JSON.stringify(networkAB.nodes, null, "\t"));
		return reject(new Error("Expected 5 nodes on joined network"));
	}
	const bottomNodeIndexes = findConductorNetworkNodes(networkAB, addVector({x:-0.5,y:0,z:0}, BOTTOM_NODE_POS));
	if( bottomNodeIndexes.length != 1 ) {
		throw new Error("Expected to find 1 bottom node; got "+JSON.stringify(bottomNodeIndexes));
	}
	const topNodeIndexes    = findConductorNetworkNodes(networkAB, addVector({x:+0.5,y:0,z:0}, TOP_NODE_POS));
	const foundEndpoints    = findConductorEndpoints( networkAB, bottomNodeIndexes );
	if( foundEndpoints.length != 2 ) {
		return reject(new Error("Expected to find 2 endpoints, but found "+JSON.stringify(foundEndpoints)));
	}
	
	const expectedResistance = approximateCopperResistivity * STD_WIRE_LENGTH*4 / STD_WIRE_CSAREA;
	
	for( let i=0; i<foundEndpoints.length; ++i ) {
		if( bottomNodeIndexes.indexOf(foundEndpoints[i].nodeIndex) >= 0 ) {
			if( foundEndpoints[i].resistance != 0 ) {
				return reject(new Error("Start node resistance not zero! "+JSON.stringify(foundEndpoints)));
			}
		} else {
			if( topNodeIndexes.indexOf(foundEndpoints[i].nodeIndex) == -1 ) {
				return reject(new Error("Expected non-start node to be #"+topNodeIndexes.join(',')+"; "+JSON.stringify(foundEndpoints)));
			}
			if( foundEndpoints[i].resistance != expectedResistance ) {
				return reject(new Error("Expected resistance of network to be "+expectedResistance+"; "+JSON.stringify(foundEndpoints)));
			}
		}
	}
	
	return resolve({});
}));
