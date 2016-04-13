import WebSocketLike from './WebSocketLike';
import {Request as ExpressRequest} from './express';

/** Implemented by the websocket-like objects in the 'ws' node library */
interface WSWebSocket extends WebSocketLike {
	upgradeReq:ExpressRequest; // It's some kind of HTTP request object
	on(eventName:string, callback:(event)=>void );
}

export default WSWebSocket;
