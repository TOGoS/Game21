/// <reference path="../../ws.d.ts"/>
/// <reference path="../../express.d.ts"/>

import WebSocketLike from './WebSocketLike';
import {Request as ExpressRequest} from 'express';

/** Implemented by the websocket-like objects in the 'ws' node library */
interface WSWebSocket extends WebSocketLike {
	upgradeReq:ExpressRequest; // It's some kind of HTTP request object
	on<T>(eventName:string, callback:(T:any)=>void ):void;
}

export default WSWebSocket;
