/**
 * Note that Error implements this,
 * so any exception is also an ErrorInfo.	
 */
interface ErrorInfo {
	message: string;
	[k: string]: any;
}

export default ErrorInfo;
