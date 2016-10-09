import Logger from '../Logger';
import KeyedList from '../KeyedList';
import DOMLogger from './DOMLogger';

// TODO: should have a logger, not be one.
class ConsoleProcess extends DOMLogger {
	public exitCode:number|null = null;
	public exit(code:number) {
		if( typeof code != 'number' ) code = 1;
		this.exitCode = code;
	}
};

type ShellCommand = (argv:string[], proc:ConsoleProcess)=>void;

export class ShellProcess extends ConsoleProcess {
	public commands:KeyedList<ShellCommand> = {};
	
	public defineCommand(name:string, implementation:ShellCommand) {
		this.commands[name] = implementation;
	}
	
	public startCommand(command:string):void {
		let argv:string[] = command.split(/\s+/);
		if( argv.length == 0 ) return;
		
		const cmdImpl = this.commands[argv[0]];
		if( cmdImpl != null ) {
			const subProc = new ConsoleProcess(this.outputElement);
			subProc.document = this.document;
			subProc.exitCode = null;
			cmdImpl( argv, subProc );
		} else {
			this.printLine(1, "Unrecognized command: "+argv[0]);
		}
	}
	
	public initUi():HTMLElement {
		var document = this.document;
		const d = document.createElement('div');
		const outputDiv = document.createElement('div');
		outputDiv.className = 'console-output';
		const commandForm = document.createElement('form');
		commandForm.className = 'console-command-form';
		const commandInput = document.createElement('input');
		commandInput.className = 'console-command-input';
		const commandSubmitButton = document.createElement('input');
		commandSubmitButton.setAttribute('type', 'Submit');
		commandSubmitButton.setAttribute('value', 'Run');
		commandSubmitButton.className = 'console-command-submit-button';
		commandForm.appendChild(commandInput);
		commandForm.appendChild(commandSubmitButton);
		commandForm.addEventListener('submit', evt => {
			evt.preventDefault();
			this.startCommand(commandInput.value);
			commandInput.value = '';
		});
		d.appendChild(outputDiv);
		d.appendChild(commandForm);
		
		this.outputElement = outputDiv;
		
		return d;
	}
}
