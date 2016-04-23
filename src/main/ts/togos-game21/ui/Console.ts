import KeyedList from '../KeyedList';

class ConsoleProcess {
	public document:HTMLDocument;
	public outputDiv:HTMLElement;
	public exitCode:number = null;
	
	public printLine(fh:number, text:string) {
		const line = this.document.createElement('p');
		line.appendChild(document.createTextNode(text));
		this.outputDiv.appendChild(line);
	}
	public log(...stuff:any[]) {
		const pre = this.document.createElement('pre');
		const texts:string[] = [];
		for( let t in stuff ) {
			texts.push(JSON.stringify(stuff[t]));
		}
		pre.appendChild(document.createTextNode(texts.join(" ")));
		this.outputDiv.appendChild(pre);
	}
	public exit(code:number) {
		if( typeof code != 'number' ) code = 1;
		this.exitCode = code;
	}
};

type ShellCommand = (argv:string[], proc:ConsoleProcess)=>void;

export class ShellProcess extends ConsoleProcess {
	protected commands:KeyedList<ShellCommand> = {};
	public defineCommand(name:string, implementation:ShellCommand) {
		this.commands[name] = implementation;
	}
	
	public startCommand(command:string):void {
		let argv:string[] = command.split(/\s+/);
		if( argv.length == 0 ) return;
		
		const cmdImpl = this.commands[argv[0]];
		if( cmdImpl != null ) {
			const subProc = new ConsoleProcess;
			subProc.document = this.document;
			subProc.outputDiv = this.outputDiv; // Or maybe give it a new one!
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
		
		this.outputDiv = outputDiv;
		
		return d;
	}
}
