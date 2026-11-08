declare module 'express' {
	export interface Request {
		url:string;
		ip:string;
		connection:any; // TODO, what is that?  Or maybe any is okay.
	}
	
	export interface Response {
		send(data:string|Uint8Array|Array<string|Uint8Array>):void;
	}
	
	export interface App {
		(req:Request, res:Response):void;
		use( ware:(req:Request, res:Response)=>void ):void;
	}
	
	/** The thing actually returned by require('express') */
	export type AppCreationFunction = () => App;
}
