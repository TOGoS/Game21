import {
	ConductorNetworkBuilder,
	findConductorEndpointsFromPosition, findConductorNetworkNodes, findConductorEndpoints,
	approximateCopperResistivity
} from './conductornetworks';
import { TestResult, registerTestResult } from './testing';
import { addVector } from './vector3dmath';
import TransformationMatrix3D from './TransformationMatrix3D';

const RIGHT_X  = +0.5;
const LEFT_X   = -0.5;
const TOP_Y    = -0.5;
const BOTTOM_Y = +0.5;

const STD_ETH_X = -3/16;
const STD_ETH_Y = -3/16;
const STD_ETH_Z = -5/16;

const STD_WIRE_CSAREA = 1/(128*128);
const STD_WIRE_LENGTH = 1;

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

const rightNodePos  = {x:RIGHT_X  , y:STD_ETH_Y, z:STD_ETH_Z};
const bottomNodePos = {x:STD_ETH_X, y:BOTTOM_Y , z:STD_ETH_Z};
const leftNodePos   = {x:LEFT_X   , y:STD_ETH_Y, z:STD_ETH_Z};
const topNodePos    = {x:STD_ETH_X, y:TOP_Y    , z:STD_ETH_Z};
const midNodePos    = {x:STD_ETH_X, y:STD_ETH_Y, z:STD_ETH_Z};

const networkA = (() => {
	const builder = new ConductorNetworkBuilder();
	
	const bottomNodeIdx = builder.addNode(bottomNodePos, {x:0,y:+1,z:0});
	const rightNodeIdx  = builder.addNode(rightNodePos , {x:+1,y:0,z:0});
	const midNodeIdx    = builder.addNode(midNodePos   );
	
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

const networkB = (() => {
	const builder = new ConductorNetworkBuilder();
	
	const topNodeIdx    = builder.addNode(topNodePos , {x:0,y:-1,z:0});
	const leftNodeIdx   = builder.addNode(leftNodePos, {x:-1,y:0,z:0});
	const midNodeIdx    = builder.addNode(midNodePos   );
	
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

const networkAB = (() => {
	const aggregateBuilder = new ConductorNetworkBuilder();
	aggregateBuilder.addNetwork(TransformationMatrix3D.translationXYZ(-0.5,0,0), networkA);
	aggregateBuilder.addNetwork(TransformationMatrix3D.translationXYZ(+0.5,0,0), networkB);
	return aggregateBuilder.network;
})();

registerTestResult( "findConductorEndpoints", new Promise<TestResult>( (resolve,reject) => {
	const bottomNodeIndexes = findConductorNetworkNodes(networkA, bottomNodePos);
	const rightNodeIndexes = findConductorNetworkNodes(networkA, rightNodePos);
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
	const bottomNodeIndexes = findConductorNetworkNodes(networkAB, addVector({x:-0.5,y:0,z:0}, bottomNodePos));
	if( bottomNodeIndexes.length != 1 ) {
		throw new Error("Expected to find 1 bottom node; got "+JSON.stringify(bottomNodeIndexes));
	}
	const topNodeIndexes    = findConductorNetworkNodes(networkAB, addVector({x:+0.5,y:0,z:0}, topNodePos));
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
