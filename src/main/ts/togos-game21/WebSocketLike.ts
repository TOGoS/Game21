interface WebSocketLike {
	binaryType : string;
	send(data:string|ArrayBuffer);
	onopen : (event:any)=>void;
	onerror : (event:any)=>void;
	onclose : (event:any)=>void;
	onmessage : (event:any)=>void;
}

export default WebSocketLike;
