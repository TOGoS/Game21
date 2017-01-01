import KeyedList from './KeyedList';
import { ShadeRaster } from './SceneShader';
import SimulationState from './Maze1SimulationState';
import {
	RoomLocation,
	Entity,
	RoomVisualEntity,
} from './world';

interface ViewScene {
	visualEntities : RoomVisualEntity[];
	visibility? : ShadeRaster;
	opacity? : ShadeRaster;
	
	// Not really 'view' data, but let's bundle it together /for now/
	viewerState? : Entity;
	
	// For omniscient ones
	simulationState? : SimulationState;
	worldTime : number;
	viewerLocation? : RoomLocation;
}

export default ViewScene;
