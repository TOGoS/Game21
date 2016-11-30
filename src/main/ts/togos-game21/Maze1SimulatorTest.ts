import MemoryDatastore from './MemoryDatastore';
import GameDataManager from './GameDataManager';
import Vector3D from './Vector3D';
import { makeAabb } from './aabbs';
import { StructureType, Room, Entity } from './world';
import { makeTileTreeNode } from './worldutil';
import { AT_STRUCTURE_OFFSET } from './simulationmessaging';
import SimulationState from './Maze1SimulationState';
import Maze1Simulator from './Maze1Simulator';
import * as dat from './maze1demodata';
import { makeTileEntityPaletteRef, makeTileTreeRef } from './worldutil';
import { TestResult, assertNotNull, assertEquals, registerTestResult } from './testing';
import newUuidRef from './newUuidRef';

const testTilePaletteTileClassRefs = [
	/*  0 */ null,
	/*  1 */ dat.toggleBoxOnEntityClassRef,
	/*  2 */ dat.toggleBoxOffEntityClassRef,
	/*  3 */ dat.wiredToggleBoxEntityClassRef,
	/*  4 */ dat.verticalEthernetSlabClassRef,
	/*  5 */ dat.horizontalEthernetSlabClassRef,
	/*  6 */ dat.topToLeftEthernetSlabClassRef,
	/*  7 */ dat.topToRightEthernetSlabClassRef,
	/*  8 */ dat.bottomToLeftEthernetSlabClassRef,
	/*  9 */ dat.bottomToRightEthernetSlabClassRef,
];
const testTilePaletteRef = 'urn:uuid:1d25f43c-9855-43af-8487-6f20122bea69';

async function setUpGdm():Promise<GameDataManager> {
	const ds = MemoryDatastore.createSha1Based(0);
	const gdm = new GameDataManager(ds);
	await dat.initData(gdm);
	makeTileEntityPaletteRef(testTilePaletteTileClassRefs, gdm, testTilePaletteRef);
	return gdm;
}

const gdmPromise:Promise<GameDataManager> = setUpGdm();

async function testEmptySimulationUpdate():Promise<TestResult> {
	const gdm = await gdmPromise;
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

function createRoom(tileIndexes:number[], gdm:GameDataManager):{
	roomRef:string,
	tileTreeRef:string
} {
	const h = Math.floor(Math.sqrt(tileIndexes.length));
	const w = tileIndexes.length / h;
	const roomRef = newUuidRef();
	const ttNode = makeTileTreeNode(
		testTilePaletteRef, w, h, 1, tileIndexes, gdm
	);
	const bounds = ttNode.tilingBoundingBox;
	const width = bounds.maxX-bounds.minX;
	const ttClassRef = gdm.tempStoreObject(ttNode);
	const tileTreeRef = newUuidRef();
	gdm.tempStoreObject<Room>({
		bounds: bounds,
		neighbors: {
			"left": {
				offset: {x:width, y:0, z:0},
				roomRef,
				bounds
			},
			"right": {
				offset: {x:-width, y:0, z:0},
				roomRef,
				bounds
			},
		},
		roomEntities: {
			[tileTreeRef]: {
				position: {x:0, y:0, z:0},
				entity: {classRef: ttClassRef}
			}
		}
	}, roomRef);
	return {roomRef, tileTreeRef};
}

import SimulationUpdate from './Maze1SimulationUpdate';

const pointAabb = makeAabb(-1/8,-1/8,-1/8, +1/8,+1/8,+1/8);

class SimulationUtil extends SimulationUpdate {
	public individualEntityAt(roomRef:string, position:Vector3D):Entity|undefined {
		const foundEntities = this.entitiesAt(roomRef, position, pointAabb, (roomEntityId,roomEntity,entity,entityClass) => {
			if( entityClass.structureType == StructureType.INDIVIDUAL ) return true;
			return undefined; 
		});
		if( foundEntities.length > 0 ) return foundEntities[0].entity;
		return undefined;
	}
	
	public doUpdate():Promise<SimulationState> {
		throw new Error("I don't do updates ha ha ha.");
	}
}

function querySimulation<T>( sim:Maze1Simulator, callback:(this:SimulationUtil) => T|Thenable<T> ):Promise<T> {
	return new Promise<T>( (resolve,reject) => {
		sim.doOneOffInterStateUpdate( (sim, state) => {
			const util = new SimulationUtil(sim,state);
			resolve(callback.bind(util)());
			return Promise.resolve(state);
		}).catch(reject);
	});
}

function fetchEntityAt( sim:Maze1Simulator, roomRef:string, pos:Vector3D ):Promise<Entity|undefined> {
	return querySimulation(sim, function(this:SimulationUtil) {
		return this.individualEntityAt(roomRef, pos);
	});
}

async function testMorphEntity():Promise<TestResult> {
	const gdm = await gdmPromise;
	const roomInfo = createRoom([2], gdm);
	const sim = new Maze1Simulator(gdm, {
		enqueuedActions: [],
		physicallyActiveRoomIdSet: {},
		rootRoomIdSet: {},
		time: 0,
		visiblyUpdatedRoomIdSet: {}
	});
	await gdm.fullyCacheRoom(roomInfo.roomRef);
	
	const entity0A = await fetchEntityAt(sim, roomInfo.roomRef, {x:0,y:0,z:0});
	if( assertNotNull(entity0A) ) {
		assertEquals(dat.toggleBoxOffEntityClassRef, entity0A.classRef);
	}
	
	sim.enqueueAction({
		classRef: "http://ns.nuke24.net/Game21/SimulationAction/InduceSystemBusMessage",
		entityPath: [
			roomInfo.roomRef, roomInfo.tileTreeRef,
			AT_STRUCTURE_OFFSET, '0,0,0'
		],
		busMessage: ['/morph', dat.toggleBoxOnEntityClassRef]
	});
	await sim.update();
	
	const entity0B = await fetchEntityAt(sim, roomInfo.roomRef, {x:0,y:0,z:0});
	if( assertNotNull(entity0B) ) {
		assertEquals(dat.toggleBoxOffEntityClassRef, entity0B.classRef);
	}	
	
	return {
		notes: [ "Okay, looks like toggle box morphed." ]
	};
}

registerTestResult('testMorphEntity', testMorphEntity());

async function testTransmitWireSignal():Promise<TestResult> {
	const gdm = await gdmPromise;
	const roomInfo = createRoom([
		5,5,8,9,
		0,0,3,4,
		0,3,0,4,
		0,7,5,6,
	], gdm);
	const sim = new Maze1Simulator(gdm, {
		enqueuedActions: [],
		physicallyActiveRoomIdSet: {},
		rootRoomIdSet: {},
		time: 0,
		visiblyUpdatedRoomIdSet: {}
	});
	await gdm.fullyCacheRoom(roomInfo.roomRef);
	
	const lowerButtonA = await fetchEntityAt(sim, roomInfo.roomRef, {x:-0.25,y:+0.25,z:0});
	const upperButtonA = await fetchEntityAt(sim, roomInfo.roomRef, {x:+0.25,y:-0.25,z:0});
	if( assertNotNull(lowerButtonA) ) {
		assertEquals(dat.wiredToggleBoxEntityClassRef, lowerButtonA.classRef);
		assertEquals(false, lowerButtonA.state != undefined && lowerButtonA.state['switchState'], "Expected lower switch to be off before signalling" );
	}
	if( assertNotNull(upperButtonA) ) {
		assertEquals(dat.wiredToggleBoxEntityClassRef, upperButtonA.classRef);
		assertEquals(false, upperButtonA.state != undefined && upperButtonA.state['switchState'], "Expected switch to be off" );
	}
	
	sim.enqueueAction({
		classRef: "http://ns.nuke24.net/Game21/SimulationAction/InduceSystemBusMessage",
		entityPath: [
			roomInfo.roomRef, roomInfo.tileTreeRef,
			AT_STRUCTURE_OFFSET, '+0.25,-0.25,0'
		],
		busMessage: ['/button/poke']
	});
	await sim.update();
	
	const lowerButtonB = await fetchEntityAt(sim, roomInfo.roomRef, {x:-0.25,y:+0.25,z:0});
	const upperButtonB = await fetchEntityAt(sim, roomInfo.roomRef, {x:+0.25,y:-0.25,z:0});
	if( assertNotNull(lowerButtonB) ) {
		assertEquals(dat.wiredToggleBoxEntityClassRef, lowerButtonB.classRef);
		assertEquals(true, lowerButtonB.state != undefined && lowerButtonB.state['switchState'], "Expected lower switch to be on after signalling" );
	}
	if( assertNotNull(upperButtonB) ) {
		assertEquals(dat.wiredToggleBoxEntityClassRef, upperButtonB.classRef);
		assertEquals(true, upperButtonB.state != undefined && upperButtonB.state['switchState'], "Expected upper switch to be on after signalling" );
	}
	
	return {
		notes: [ "Okay, looks like a signal was passed successfuly through the conductor network." ]
	};
}

registerTestResult('testTransmitWireSignal', testTransmitWireSignal());
