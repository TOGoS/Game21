// Thought experiment.

interface UpdateResult<System,Message> {
	outgoingMessages:Message[];
	updatedSystem:System;
}

interface SelfContainedSystemSimulator<System,Event,Message> {
	update(system:System, time:number, events:Event[]):Promise<UpdateResult<System,Message>>;
	getNextAutoUpdateTime(system:System, currentTime:number):number;
}
