// This is just a copy of Logger.  TODO: delete
interface MiniConsole {
   log(message?: any, ...optionalParams: any[]): void;
   warn(message?: any, ...optionalParams: any[]): void;
   debug(message?: string, ...optionalParams: any[]): void;
   error(message?: any, ...optionalParams: any[]): void;
}

export default MiniConsole;
