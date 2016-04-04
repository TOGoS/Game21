export class Greeter {
	public greeting;
	public somethingElse;
	constructor(greeting:string='Wat') {
		this.greeting = greeting;
		this.somethingElse = 32;
	}
	greet(name : String) {
		return this.greeting + ", " + name + "!  ;D";
	}
}
