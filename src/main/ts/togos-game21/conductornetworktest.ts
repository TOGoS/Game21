import { ConductorNetworkBuilder, findConductorEndpoints } from './conductornetworks';
import { TestResult, registerTestResult } from './testing';

const STD_ETH_X = -3/16;
const STD_ETH_Y = -3/16;
const STD_ETH_Z = -5/16;

const STD_WIRE_CSAREA = 1/(128*128);
const STD_WIRE_LENGTH = 1;

/*

 +-+-+-+-+-+-+-+-+
 |               |
 |   X===========X
 |   |           |
 |   |           |
 |   |           |
 |   |           |
 |   |           |
 |   |           |
 +-+-X-+-+-+-+-+-+

*/

registerTestResult( "findConductorEndpoints", new Promise<TestResult>( (resolve,reject) => {
	const builder = new ConductorNetworkBuilder();
	
	const bottomNodePos = {x:STD_ETH_X, y:+0.5     , z:STD_ETH_Z};
	const rightNodePos  = {x:+0.5     , y:STD_ETH_Y, z:STD_ETH_Z};
	const midNodePos    = {x:STD_ETH_X, y:STD_ETH_Y, z:STD_ETH_Z};
	
	const bottomNodeIdx = builder.addNode(bottomNodePos, true);
	const rightNodeIdx  = builder.addNode(rightNodePos , true);
	const midNodeIdx    = builder.addNode(midNodePos   , false);
	
	builder.link( bottomNodeIdx, midNodeIdx, {
		crossSectionalArea: STD_WIRE_CSAREA,
		length: STD_WIRE_LENGTH,
	});
	builder.link( rightNodeIdx, midNodeIdx, {
		crossSectionalArea: STD_WIRE_CSAREA,
		length: STD_WIRE_LENGTH,
	});
	
	const foundEndpoints = findConductorEndpoints( builder.network, [bottomNodeIdx] );
	
	if( foundEndpoints.length != 2 ) {
		return reject(new Error("Expected to find 2 endpoints, but found only "+JSON.stringify(foundEndpoints)));
	}
	
	return resolve({});
}));
