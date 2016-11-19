import { ConductorNetworkBuilder, findConductorEndpoints } from './conductornetworks';

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

{
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
	})
	
	// TODO: Test that both external endpoints are found
	// findConductorEndpoints( builder.network, bottomNodePos )
}
