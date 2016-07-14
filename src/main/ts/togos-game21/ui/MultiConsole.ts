import MiniConsole from './MiniConsole';

export default class MultiConsole implements MiniConsole {
	public constructor( protected backends:MiniConsole[] ) {
	}
	
	public log( message?:any, ...optionalParams:any[] ) {
		for( let b in this.backends ) this.backends[b].log( message, ...optionalParams );
	}
	public warn( message?:any, ...optionalParams:any[] ) {
		for( let b in this.backends ) this.backends[b].warn( message, ...optionalParams );
	}
	public debug( message?:any, ...optionalParams:any[] ) {
		for( let b in this.backends ) this.backends[b].debug( message, ...optionalParams );
	}
	public error( message?:any, ...optionalParams:any[] ) {
		for( let b in this.backends ) this.backends[b].error( message, ...optionalParams );
	}
}
