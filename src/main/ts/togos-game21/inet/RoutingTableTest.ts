import RoutingTable from './RoutingTable.ts';
import { registerTestResult, assertEqualsPromise } from '../testing.ts';
import { hexDecode } from '../../tshash/utils.ts';

const rt = new RoutingTable<string>();

rt.addRoute( hexDecode('aabb0000'), 16, 'a' );
rt.addRoute( hexDecode('aabbcc00'), 24, 'b' );
rt.addRoute( hexDecode('eeff0000'), 16, 'c' );

const rp = assertEqualsPromise('a', rt.findDestination(hexDecode('aabb1212'))).then(
	() => assertEqualsPromise('b', rt.findDestination(hexDecode('aabbcc12')))
).then(
	() => assertEqualsPromise('c', rt.findDestination(hexDecode('eeff1234')))
).then(
	() => assertEqualsPromise(null,rt.findDestination(hexDecode('11223344')))
);

registerTestResult( "look stuff up in routing table", rp );
