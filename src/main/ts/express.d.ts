declare module 'express' {
	export interface Request {
		url:string;
		ip:string;
		connection:any; // TODO, what is that?  Or maybe any is okay.
	}
	
	export interface Response {
		send(data:string|Buffer|Array<string|Buffer>):void;
	}
	
	const Express : any;
	export default Express;
}
