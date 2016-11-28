import { networkA, networkB, networkAB } from './conductornetworktest';

import { registerTestResult, assertEqualsPromise, TestResult } from './testing';

import { UNIT_CUBE } from './aabbs';
import MemoryDatastore from './MemoryDatastore';
import GameDataManager from './GameDataManager';
import {
	Entity,
	EntityClass,
	TileTree,
	StructureType
} from './world';
import { makeTileTreeRef } from './worldutil';

import { EntityConductorNetworkCache } from './entityconductornetworks';

registerTestResult( "getEntityConductorNetwork", new Promise<TestResult>( (resolve,reject) => {
	const mds = MemoryDatastore.createSha1Based(0);
	const gdm = new GameDataManager(mds);
	const tileARef = gdm.tempStoreObject<EntityClass>({
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		defaultSubsystems: {
			"cn0": networkA
		}
	});
	const tileBRef = gdm.tempStoreObject<EntityClass>({
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		defaultSubsystems: {
			"cn0": networkB
		}
	});
	const treeRef = makeTileTreeRef([null, tileARef, tileBRef], 2, 1, 1, [1,2], gdm);
	const treeEntity:Entity = {
		classRef: treeRef
	};
	
	const ecnc = new EntityConductorNetworkCache(gdm);
	const p = ecnc.fetchEntityConductorNetwork( treeEntity ).then( (cn) => {
		return assertEqualsPromise( cn, networkAB );
	});
	
	resolve(p);
}));
