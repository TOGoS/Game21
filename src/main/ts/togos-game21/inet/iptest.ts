import { hexEncode } from '../../tshash/utils';
import { assertEqualsPromise, registerTestResult } from '../testing';
import { parseIp6Address } from './IP6Address'
import {
	IP6Message, IPMessage, assembleIpPacket, disassembleIpPacket
} from './ip';
import { utf8Encode } from '../../tshash/utils';

function debug( obj:any ):any {
	if( typeof(obj) === 'object' ) {
		if( obj instanceof DataView ) {
			return debug( new Uint8Array(obj.buffer, obj.byteOffset, obj.byteLength) );
		} else if( obj instanceof Uint8Array ) {
			return hexEncode(obj);
		} else {
			const d:any = {};
			for( let i in obj ) {
				d[i] = debug((<any>obj)[i]);
			}
			return d;
		}
	} else {
		return obj;
	}
}

const testMessage:IP6Message = {
	ipVersion: 6,
	trafficClass: 123, // IDK what's supposed to go in here
	flowLabel: 0xEDCBA, // Any more bits and it would clobber trafficClass
	protocolNumber: 161,
	hopLimit: 42,
	sourceAddress: parseIp6Address('2001::1002'),
	destAddress: parseIp6Address('2001::1003'),
	payload: utf8Encode("Hello, world!")
}

function assertDebequalsPromise( a:any, b:any, msg:string=null ) {
	return assertEqualsPromise( debug(a), debug(b), msg );
}

const disassembledMessage = disassembleIpPacket( assembleIpPacket(testMessage) );

registerTestResult( "ip assemble/disassemble", assertDebequalsPromise(testMessage, disassembledMessage) );
