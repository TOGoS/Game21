export class Greeter {
	protected greeting;
	constructor(greeting) {
		this.greeting = greeting;
	}
	greet(name : String) {
		return this.greeting + ", " + name + "!  ;D";
	}
}
