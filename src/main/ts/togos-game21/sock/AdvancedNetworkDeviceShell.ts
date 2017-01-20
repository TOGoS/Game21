import MessageLink from './MessageLink';

//// Link pair/codec crap

interface MessageCodec<A,B> {
	encode( A ):B;
	decode( B ):A;
}

interface LinkPair<MessageA,MessageB> {
	linkA: MessageLink<MessageA>;
	linkB: MessageLink<MessageB>;
}

function combineCodec<A,B,C>( codec0:MessageCodec<A,B>, codec1:MessageCodec<B,C> ):MessageCodec<A,C> {
	return {
		encode: (a:A):C => codec1.encode(codec0.encode(a)),
		decode: (c:C):A => codec0.decode(codec1.decode(c)),
	};
}

const NOOP_CODEC = {
	encode: <T>(x:T):T => x,
	decode: <T>(x:T):T => x,
}

function createLinkPair<A,B>( codec:MessageCodec<A,B> ):LinkPair<A,B> {
	let delivery = Promise.resolve();
	let deliverToA = (packet:A) => {};
	let deliverToB = (packet:B) => {};
	const linkA = {
		state: <"up"|"down">"down",
		packetListener: <(packet:A)=>void|undefined>undefined,
		setUp(listener:(packet:A)=>void) { this.state = "up"; this.packetListener = listener },
		send(packet:A) {
			if( this.state == "down" ) return;
			delivery = delivery.then( () => deliverToB(codec.encode(packet)) );
		},
		setDown() { this.state = "down"; }
	}
	const linkB = {
		state: <"up"|"down">"down",
		packetListener: <(packet:B)=>void|undefined>undefined,
		setUp(listener:(packet:B)=>void) { this.state = "up"; this.packetListener = listener },
		send(packet:B) {
			if( this.state == "down" ) return;
			delivery = delivery.then( () => deliverToA(codec.decode(packet)) );
		},
		setDown() { this.state = "down"; }
	}
	deliverToA = (packet:A) => {
		if( linkA.state == "up" && linkA.packetListener ) linkA.packetListener(packet);
	}
	deliverToB = (packet:B) => {
		if( linkB.state == "up" && linkB.packetListener ) linkB.packetListener(packet);
	}
	return { linkA, linkB };
}
