import MemoryDatastore from './MemoryDatastore';
import GameDataManager from './GameDataManager';
import Maze1Simulator from './Maze1Simulator';
import * as dat from './maze1demodata';
import { makeTileEntityPaletteRef, makeTileTreeRef } from './worldutil';
import { TestResult, assertEquals, registerTestResult } from './testing';

async function setUpGdm():Promise<GameDataManager> {
	const ds = MemoryDatastore.createSha1Based(0);
	const gdm = new GameDataManager(ds);
	await dat.initData(gdm);
	return gdm;
}

async function testEmptySimulationUpdate():Promise<TestResult> {
	const gdm = await setUpGdm(); 
	const sim = new Maze1Simulator(gdm, {
		enqueuedActions: [],
		physicallyActiveRoomIdSet: {},
		rootRoomIdSet: {},
		time: 0,
		visiblyUpdatedRoomIdSet: {}
	});
	const newState1 = await sim.update();
	assertEquals( sim.majorStepDuration, newState1.time, "state1's #time should be = majorStepDuration" ); 
	const newState2 = await sim.update();
	assertEquals( sim.majorStepDuration*2, newState2.time, "state2's #time should be = majorStepDuration*2" ); 
	return {
		notes: [ "Okay, simulation updated, I guess" ]
	};
}

registerTestResult( "testEmptySimulationUpdate", testEmptySimulationUpdate() );	
