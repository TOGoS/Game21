import {
	SimulationAction
} from './simulationmessaging';
import {
	HardRef, SoftRef, LWSet
} from './lwtypes';
import {
	RoomRef as RoomID
} from './world';

/**
 * Represents the state of the simulator between steps.
 */
export interface SimulationState {
	time : number;
	enqueuedActions : SimulationAction[];
	
	// physcallyActive and visiblyUpdatedRoomIdSet
	// can be thought of as queues optimized for many identical
	// events that are handled by special-case steps.
	
	/**
	 * IDs of rooms that with potentially physically active things.
	 * This does not need to include neighboring rooms,
	 * though they will also need to be loaded before doing the physics update.
	 * The physics update step will do the physics update and then
	 * rewrite this set.  All other steps will only add to it.
	 */
	physicallyActiveRoomIdSet? : LWSet<RoomID>;
	visiblyUpdatedRoomIdSet? : LWSet<RoomID>;
	/**
	 * Start point when searching for entities.
	 */
	rootRoomIdSet : LWSet<RoomID>;
}

export interface HardSimulationState extends SimulationState {
	dataRef : HardRef;
}

export default SimulationState;
