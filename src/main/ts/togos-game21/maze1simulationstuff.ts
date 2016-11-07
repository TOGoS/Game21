import Vector3D from './Vector3D';
import KeyedList from './KeyedList';
import Logger from './Logger';
import GameDataManager from './GameDataManager';
import { EntityPath } from './simulationmessaging';
import EntitySystemBusMessage from './EntitySystemBusMessage';
import EntitySubsystem from './EntitySubsystem';
import {
	RoomEntity,
	Entity,
	EntityClass
} from './world'

export interface ExternalDevice {
	onMessage( bm:EntitySystemBusMessage, sourcePath?:EntityPath ):void
}

export interface SimulationUpdateContext {
	logger:Logger;
	gameDataManager:GameDataManager;
	majorStepDuration:number;
	logicStepDuration:number;
	externalDevices:KeyedList<ExternalDevice>;
}

export interface RoomEntityUpdate {
	destroyed? : boolean;
	roomRef? : string;
	position? : Vector3D;
	velocityPosition? : Vector3D;
	velocity? : Vector3D;
	desiredMovementDirection? : Vector3D;
	subsystems? : KeyedList<EntitySubsystem>;
}

/*
 * Return values:
 *   true = yes, include this!
 *   false = I do not care about this at all!
 *   undefined = I don't care about this specific thing, but I may care about things contained in it
 */
export type EntityFilter = (roomEntityId:string, roomEntity:RoomEntity, entity:Entity, entityClass:EntityClass)=>boolean|undefined; 

export interface FoundEntity {
	entityPath : EntityPath;
	
	roomRef : string;
	roomEntityId : string;
	roomEntity : RoomEntity;
	
	// Individual entity that was collided-with
	entity : Entity;
	entityPosition : Vector3D;
	entityClass : EntityClass; // since we have it anyway!
}
