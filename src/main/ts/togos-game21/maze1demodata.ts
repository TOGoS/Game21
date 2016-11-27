import Vector3D from './Vector3D';
import { makeVector } from './vector3ds';
import AABB from './AABB';
import { makeAabb } from './aabbs';
import {
	Room,
	EntityClass,
	AttachmentZoneClass,
	AZTYPE_HAND,
	StructureType,
	TileTree,
} from './world';
import {
	deepFreeze
} from './DeepFreezer';
import {
	makeTileEntityPaletteRef,
	makeTileTreeRef
} from './worldutil';
import {
	ESSCR_CONDUCTOR_NETWORK,
	ConductorNetwork
} from './EntitySubsystem';
import {
	ConductorNetworkBuilder
} from './conductornetworks';
import { ROOMID_FINDENTITY, CHAN_SNS, XMSN_COPPER } from './simulationmessaging';
import * as esp from './internalsystemprogram';
import GameDataManager from './GameDataManager';
/// <reference path="../Promise.d.ts"/>

function sExpressionToProgramExpressionRef(sExp:any[], gdm:GameDataManager):string {
	return gdm.tempStoreObject<esp.ProgramExpression>(
		esp.sExpressionToProgramExpression(sExp)
	);
}

function hexDig(i:number):string {
	return String.fromCharCode( i < 10 ? 48 + i : 87 + i );
}

function hexEncodeBits( pix:Array<number> ):string {
	let enc:string = "";
	for( let i = 0; i+4 <= pix.length; i += 4 ) {
		const num = (pix[i+0]<<3) | (pix[i+1]<<2) | (pix[i+2]<<1) | (pix[i+3]<<0);
		enc += hexDig(num);
	}
	return enc;
}

function rgbaToNumber( r:number, g:number, b:number, a:number ):number {
	return ((r&0xFF)<<24) | ((g&0xFF)<<16) | ((b&0xFF)<<8) | (a&0xFF);
}

//// Images

const rox1Pix = [
	0,0,1,1,1,0,0,0,0,0,0,1,1,1,1,0,
	0,1,1,1,1,1,1,0,0,0,1,0,1,1,1,1,
	0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,
	0,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,
	0,1,1,1,1,1,1,1,0,0,0,1,1,1,1,0,
	0,0,1,1,1,0,0,0,1,1,0,0,0,0,0,0,
	1,0,0,0,0,0,1,1,1,1,1,0,1,1,1,1,
	1,1,1,1,1,0,0,1,1,1,0,1,1,1,1,1,
	1,1,1,1,1,0,0,0,0,0,0,1,1,1,1,1,
	1,1,1,0,1,0,1,1,1,1,0,0,1,1,1,1,
	1,1,1,0,0,1,1,1,1,1,0,0,0,0,0,0,
	0,0,0,0,1,1,1,1,0,0,0,0,0,1,1,1,
	1,1,0,0,1,1,1,0,1,1,1,0,1,1,1,1,
	1,1,1,0,0,0,0,1,1,1,1,0,1,1,1,1,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	1,1,0,0,0,0,1,1,1,1,0,0,0,0,0,0,
];
const brikPix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	1,1,1,0,0,1,1,1,1,1,1,0,0,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
];
const bigBrikPix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
];
const playerPix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,
	0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,
	0,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,
	0,0,0,0,1,0,1,0,1,0,1,0,1,0,0,0,
	0,0,0,0,1,0,1,0,1,0,1,0,1,0,0,0,
	0,0,0,0,1,0,1,0,0,0,1,0,1,0,0,0,
	0,0,0,0,1,0,1,1,1,1,1,0,1,0,0,0,
	0,0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,
	0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,
	0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0,
	0,0,1,1,1,1,0,0,0,0,0,1,1,1,1,0,
];
const deadPlayerPix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,
	0,1,1,1,1,0,1,0,1,0,0,0,0,0,0,0,
	0,0,1,1,0,0,1,0,1,0,1,1,0,1,1,0,
	0,1,1,1,1,0,1,0,1,0,0,0,1,0,0,0,
	0,1,0,1,0,0,0,1,0,1,1,1,0,1,1,0,
];
const plant1Pix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,
	0,0,0,0,1,0,0,1,0,0,1,0,1,1,0,0,
	0,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,
	0,0,0,0,1,1,1,1,0,0,1,0,1,0,0,0,
	0,0,1,1,0,1,0,0,1,1,1,0,0,1,0,0,
	0,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,
	0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,
	0,0,0,0,1,0,1,0,1,1,1,1,0,1,0,0,
	0,0,0,0,0,0,0,0,1,1,0,0,1,1,0,0,
	0,0,1,1,1,1,0,1,1,0,0,0,0,0,1,0,
	0,1,0,0,0,0,1,1,1,1,1,1,0,0,0,0,
	0,0,0,0,0,0,0,1,1,0,0,0,1,0,0,0,
	0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,
];
const vines1Pix = [
	0,0,0,1,0,0,1,0,0,0,1,0,0,1,1,0,
	0,0,1,0,0,0,1,0,0,1,0,1,0,0,0,1,
	0,0,1,0,0,1,0,0,0,1,0,0,1,1,1,0,
	0,0,1,0,1,0,0,0,0,1,0,0,0,1,0,0,
	0,0,1,0,1,0,1,0,0,1,0,0,1,1,1,0,
	0,0,0,1,0,1,1,1,0,0,1,0,0,1,1,0,
	0,0,1,1,0,0,1,1,0,0,0,1,0,0,1,0,
	0,1,0,0,1,0,1,0,0,0,0,1,0,1,0,0,
	0,1,0,0,1,0,0,1,1,0,0,0,1,0,0,0,
	0,0,0,0,1,0,0,1,0,1,0,0,1,0,0,0,
	0,0,0,1,0,0,0,1,0,0,1,0,1,0,0,0,
	0,0,1,0,0,0,1,0,0,0,1,0,0,1,0,0,
	0,0,1,0,0,1,1,1,0,0,1,0,0,1,0,0,
	0,1,0,1,0,1,1,1,0,1,0,0,0,1,0,0,
	0,1,0,0,1,0,1,0,1,0,0,0,1,0,0,0,
	0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,
];
const roots1Pix = [
	0,1,0,0,0,1,0,0,0,0,0,1,1,0,0,0,
	0,1,0,0,0,1,1,0,0,1,1,0,1,0,0,0,
	0,0,1,0,0,0,1,0,1,0,0,0,1,1,0,0,
	0,0,1,0,0,0,1,0,1,0,0,1,0,1,0,0,
	0,0,1,0,0,0,1,1,0,1,0,1,0,0,1,0,
	0,1,0,0,0,1,0,1,0,0,0,1,0,0,0,1,
	1,0,1,1,0,1,0,1,0,0,1,0,1,0,0,1,
	1,0,1,0,1,0,0,1,0,0,0,0,0,0,1,0,
	0,0,0,0,1,0,0,1,1,0,0,0,0,0,1,0,
	0,0,0,1,1,1,0,0,1,1,0,0,0,1,0,0,
	0,0,1,1,0,1,0,1,0,1,1,0,1,0,1,0,
	0,1,1,0,0,1,0,1,0,0,1,0,1,0,1,0,
	0,1,0,1,0,1,1,1,0,0,1,1,0,0,1,0,
	1,1,0,0,0,0,1,0,1,0,0,1,0,1,0,1,
	1,0,1,0,0,1,1,0,0,0,0,1,0,1,0,0,
	1,0,0,1,0,1,0,0,0,0,1,1,0,0,0,0,
]
const ladder1FrontPix = [
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
	0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,
];
const ladder1SidePix = [
	0,1,1,0,
	0,1,1,0,
	1,1,1,1,
	0,1,1,0,
	0,1,1,0,
	0,1,1,0,
	1,1,1,1,
	0,1,1,0,
	0,1,1,0,
	0,1,1,0,
	1,1,1,1,
	0,1,1,0,
	0,1,1,0,
	0,1,1,0,
	1,1,1,1,
	0,1,1,0,
];
const ladder1TopPix = [
	0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,
];
const doorFramePix = [
	1,1,0,1,
	1,0,1,1,
	1,1,0,1,
	1,0,0,1,
];
const doorTrackPix = [
	0,0,0,0,
	1,0,1,0,
	0,1,0,1,
	0,0,0,0,
];
const chunkPix = [
	0,1,1,1,
	1,1,1,0,
];
const doorSegmentPix = [
	0,0,1,1,1,1,1,1,0,0,
	0,1,1,0,0,0,0,1,1,0,
	0,1,0,0,1,1,0,0,1,0,
	1,1,0,1,0,0,1,0,1,1,
	1,1,0,1,0,0,1,0,1,1,
	0,1,0,1,0,0,1,0,1,0,
	0,1,0,1,0,0,1,0,1,0,
	0,1,0,1,0,0,1,0,1,0,
	0,1,0,1,0,0,1,0,1,0,
	0,1,0,1,0,0,1,0,1,0,
	0,1,0,1,0,0,1,0,1,0,
	1,1,0,1,0,0,1,0,1,1,
	1,1,0,1,0,0,1,0,1,1,
	0,1,0,0,1,1,0,0,1,0,
	0,1,1,0,0,0,0,1,1,0,
	0,0,1,1,1,1,1,1,0,0,
];
const platformSegmentPix = [
	1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,
	1,0,0,0,0,0,0,1,
	1,1,1,1,1,1,1,1,
	1,0,0,0,0,0,0,1,
	0,1,0,0,0,0,1,0,
	0,0,1,0,0,1,0,0,
	1,1,1,1,1,1,1,1,
]
const ballPix = [
   0,0,1,1,1,1,0,0,
	0,1,1,1,1,1,1,0,
	1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,0,1,
	1,1,1,1,1,1,0,1,
	1,1,1,1,1,0,0,1,
	0,1,1,0,0,0,1,0,
	0,0,1,1,1,1,0,0,
];
const latticeColumnPix = [
	1,1,1,1,1,1,1,1,
	1,1,0,0,0,0,1,1,
	1,1,1,0,0,1,1,1,
	1,1,0,1,1,0,1,1,
	1,1,0,1,1,0,1,1,
	1,1,1,0,0,1,1,1,
	1,1,0,0,0,0,1,1,
	1,1,1,1,1,1,1,1,
];
const keyPix = [
	0,1,1,1,0,0,0,0,
	1,1,0,1,1,1,1,1,
	1,1,0,1,1,1,1,1,
	0,1,1,1,0,1,0,1,
];
const applePix = [
	0,0,0,0,0,1,0,0,
	0,0,0,0,1,0,0,0,
	0,1,1,1,0,1,1,0,
	1,1,1,1,1,1,1,1,
	1,1,1,1,1,0,1,1,
	1,1,1,1,1,0,1,1,
	0,1,1,1,0,1,1,0,
	0,0,1,0,1,1,0,0,
];
const stick1Pix = [
	0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,1,
	0,0,0,0,0,0,1,0,
	0,0,0,0,0,1,0,0,
	0,0,1,1,1,0,0,0,
	1,1,0,0,0,1,1,1,
];
const stick2Pix = [
	0,0,0,0,0,0,0,0,
	0,0,0,1,0,0,0,0,
	0,0,0,1,0,0,0,0,
	0,1,0,0,1,1,0,0,
	0,0,1,1,0,0,1,0,
	1,1,0,0,0,0,0,1,
]
const cheapDoorPix = [
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,0,1,1,0,0,1,1,0,0,
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,0,1,1,0,0,1,1,0,0,
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,0,1,1,0,0,1,1,0,0,
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,1,1,0,1,1,0,1,1,0,
	0,0,1,1,0,0,1,1,0,0,
	0,1,1,0,1,1,0,1,1,0,
];
const triforcePix = [
	0,0,0,0,0,1,1,0,0,0,0,0,
	0,0,0,0,0,1,1,0,0,0,0,0,
	0,0,0,0,1,1,1,1,0,0,0,0,
	0,0,0,0,1,1,1,1,0,0,0,0,
	0,0,0,1,1,1,1,1,1,0,0,0,
	0,0,0,1,1,1,1,1,1,0,0,0,
	0,0,1,1,0,0,0,0,1,1,0,0,
	0,0,1,1,0,0,0,0,1,1,0,0,
	0,1,1,1,1,0,0,1,1,1,1,0,
	0,1,1,1,1,0,0,1,1,1,1,0,
	1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,
]
const toggleBoxOffPix = [
	1,1,1,1,1,1,1,1,
	1,0,0,0,0,0,0,0,
	1,0,0,0,0,0,1,0,
	1,0,0,0,0,0,1,0,
	1,0,0,0,0,0,1,0,
	1,0,0,0,0,0,1,0,
	1,0,1,1,1,1,1,0,
	1,0,0,0,0,0,0,0,
]
const toggleBoxOnPix = [
	1,1,1,1,1,1,1,1,
	1,0,0,0,0,0,0,0,
	1,0,0,1,0,1,1,0,
	1,0,1,0,1,0,1,0,
	1,0,0,1,0,1,1,0,
	1,0,1,0,1,0,1,0,
	1,0,1,1,1,1,1,0,
	1,0,0,0,0,0,0,0,
]
const eighthMeterWirePix = [
	1,1,1,1
]
const eighthMeterWireBottomToRightPix = [
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,
	0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,
	0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,
	0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,
	0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,
	0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,
	0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,
	0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,
	0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,
	0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,
	0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,
	0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,
]

function bitImgColor(c:number|number[]):number {
	if( typeof c == 'number' ) return c;
	if( c.length == 3 ) {
		return rgbaToNumber(c[0], c[1], c[2], 255);
	} else if( c.length == 4 ) {
		return rgbaToNumber(c[0], c[1], c[2], c[3]);
	}
	throw new Error("BitImg color parameter must be a number of array of length 3 or 4");
}
function bitImgRef(
	color0:number|number[],color1:number|number[],pixDat:number[],
	width?:number,height?:number,originX?:number,originY?:number
):string {
	const mods:string[] = [];
	if( color0 != 0 ) mods.push("color0="+bitImgColor(color0));
	mods.push("color1="+bitImgColor(color1));
	if( width != undefined ) mods.push("width="+width);
	if( height != undefined ) mods.push("height="+height);
	if( originX != undefined ) mods.push("originX="+originX);
	if( originY != undefined ) mods.push("originY="+originY);
	return "bitimg:"+mods.join(';')+","+hexEncodeBits(pixDat);
}

const black = [0,0,0];
const wallBlue = [128,128,220];
const wallRed = [220,128,128];
const wallYellow = [220,220,128];

const tanRox1ImgRef = bitImgRef(black,[180,160,140],rox1Pix);
const brikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(200,200,180,255)+","+hexEncodeBits(brikPix);
const brownBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(200,180,128,255)+","+hexEncodeBits(brikPix);
const grayBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(128,128,128,255)+","+hexEncodeBits(brikPix);
const blueBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(128,128,220,255)+","+hexEncodeBits(brikPix);
const yellowBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(220,220,128,255)+","+hexEncodeBits(brikPix);
const redBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(220,128,128,255)+","+hexEncodeBits(brikPix);
const bigBrikImgRef = "bitimg:color0=0;color1="+rgbaToNumber(220,220,200,255)+","+hexEncodeBits(bigBrikPix);
const bigBlueBrikImgRef   = bitImgRef(black,wallBlue,bigBrikPix);
const bigYellowBrikImgRef = bitImgRef(black,wallYellow,bigBrikPix);
const bigRedBrikImgRef    = bitImgRef(black,wallRed,bigBrikPix);
const plant1ImgRef         = bitImgRef(0,[64,192,64],plant1Pix);
const browningPlant1ImgRef = bitImgRef(0,[64,112,64],plant1Pix);
const brownPlant1ImgRef    = bitImgRef(0,[80, 72,48],plant1Pix);
const vines1ImgRef = bitImgRef(0,[64,192,64],vines1Pix);
const browningVines1ImgRef = bitImgRef(0,[64,128,64],vines1Pix);
const roots1ImgRef = bitImgRef(0,[96,80,64],roots1Pix);
const ballImgRef = "bitimg:color0=0;color1="+rgbaToNumber(128,48,48,255)+","+hexEncodeBits(ballPix);
const doorFrameImgRef = "bitimg:color1="+rgbaToNumber(64,64,64,255)+","+hexEncodeBits(doorFramePix);
const doorSegmentImgRef = 'bitimg:width=10;height=16;color1='+rgbaToNumber(240,240,230,255)+","+hexEncodeBits(doorSegmentPix);
const platformSegmentImgRef = 'bitimg:color1='+rgbaToNumber(240,240,160,255)+","+hexEncodeBits(platformSegmentPix);
const ladder1FrontImgRef = "bitimg:color1="+rgbaToNumber(128,96,96,255)+","+hexEncodeBits(ladder1FrontPix);
const ladder1SideImgRef = "bitimg:width=4;height=16;color1="+rgbaToNumber(128,96,96,255)+","+hexEncodeBits(ladder1SidePix);
const ladder1TopImgRef = "bitimg:width=16;height=4;color1="+rgbaToNumber(128,96,96,255)+","+hexEncodeBits(ladder1TopPix);
const latticeColumnImgRef = "bitimg:color1="+rgbaToNumber(192,192,192,255)+","+hexEncodeBits(latticeColumnPix);
const latticeColumnBgImgRef = "bitimg:color1="+rgbaToNumber(64,64,64,255)+","+hexEncodeBits(latticeColumnPix);
const toggleBoxOffImgRef = bitImgRef(0,[96,96,96],toggleBoxOffPix);
const toggleBoxOnImgRef  = bitImgRef(0,[96,96,96],toggleBoxOnPix );
export const greenToggleBoxOffImgRef = bitImgRef(0,[64,128,64],toggleBoxOffPix);
export const greenToggleBoxOnImgRef  = bitImgRef(0,[64,128,64],toggleBoxOnPix );
const eighthMeterWireImgRef   = bitImgRef(0,[88,88,88],eighthMeterWirePix);

const playerImgRef        = bitImgRef(0,[224,224,96],playerPix);
const deadPlayerImgRef    = bitImgRef(0,[112,96,48],deadPlayerPix,16,8,8,6);

const blueKeyImgRef   = bitImgRef(0,  [0,  0,192],keyPix,8,4);
const yellowKeyImgRef = bitImgRef(0,[192,192,  0],keyPix,8,4);
const redKeyImgRef    = bitImgRef(0,[192,  0,  0],keyPix,8,4);
const triforceImgRef  = bitImgRef(0,[200,200,128],triforcePix,12,12);
const appleImgRef     = bitImgRef(0,[160,64,32],applePix);
const stick1ImgRef    = bitImgRef(0,[112,96,72],stick1Pix,8,6,4,4);
const stick2ImgRef    = bitImgRef(0,[112,96,72],stick2Pix,8,6,4,4);
const vomitChunk1ImgRef= bitImgRef(0,[128,96,48],chunkPix,4,2);
const vomitChunk2ImgRef= bitImgRef(0,[96,128,48],chunkPix,4,2);
const vomitChunk3ImgRef= bitImgRef(0,[160,192,64],chunkPix,4,2);

const cheapBlueDoorImgRef   = bitImgRef(0,[  0,  0,192],cheapDoorPix,10,16);
const cheapYellowDoorImgRef = bitImgRef(0,[192,192,  0],cheapDoorPix,10,16);
const cheapRedDoorImgRef    = bitImgRef(0,[192,  0,  0],cheapDoorPix,10,16);

//// Room data

export const room1Id = 'urn:uuid:9d424151-1abf-45c1-b581-170c6eec5941';
export const room2Id = 'urn:uuid:9d424151-1abf-45c1-b581-170c6eec5942';
export const room3Id = 'urn:uuid:9d424151-1abf-45c1-b581-170c6eec5943';

const room1Data = [
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0,13, 0, 0,12,
	1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0,13, 0, 0,10,
	1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 2, 0,13, 0, 0,10,
	1, 0,16, 0, 0,33, 1, 8, 8, 8, 0, 0,13, 0, 0,10,
	1, 0,16, 0, 0,32, 1, 2, 2, 2, 2, 2,11, 0, 0,10,
	1, 0,16, 0, 5,31,30, 0, 5, 0, 0, 0,13, 0, 0,10,
	1, 0, 2, 2, 5, 1, 1, 2, 5, 1, 1, 1,11, 0, 0,12,
	1, 0, 2, 1, 5, 0, 1, 2, 5, 1, 0, 2,11, 0, 0,12,
	1, 0, 0, 0, 2, 2, 2, 2, 5, 1, 0, 2,11, 0, 0,10,
	0, 0, 5, 0, 0, 0, 0, 0, 5, 0, 0, 2,11, 0, 0,12,
	1, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 5, 1, 1, 0, 0, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 0, 5, 0, 0, 0, 0, 8, 8, 8, 0, 0,13, 0, 0,10,
	1, 3, 5, 3, 1, 1, 0, 2, 2, 2, 0, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
];
const room3Data = [
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,11, 0, 0,10,
];
const room2Data = [
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	0, 0, 5, 0, 0, 0, 0, 0, 9, 9, 0, 9, 1, 0, 1, 0,
	1, 0, 5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0,
	1, 1, 1, 0, 1, 1, 1, 2, 7, 0, 0, 0, 1, 0, 0, 1,
	1, 1, 1, 0, 1, 1, 1, 2, 7, 0, 0, 0, 0, 0, 1, 1,
	1, 1, 1, 0, 8, 8, 4, 8, 7, 0, 0, 2, 2, 2, 1, 1,
	1, 0, 0, 0, 8, 8, 4, 8, 7, 0, 0, 0, 0, 0, 0, 0,
	1, 0, 2, 2, 2, 1, 4, 2, 7, 0, 0, 6, 1, 3, 3, 7,
	1, 0, 0, 0, 0, 1, 4, 2, 7, 0, 0, 6, 1, 1, 1, 7,
	1, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 6, 1, 1, 1, 1,
	0, 0, 5, 0, 0, 0, 4, 0, 0, 0, 0, 6, 1, 0, 0, 0,
	1, 2, 5, 1, 1, 1, 1, 1, 1, 3, 3, 6, 1, 0, 1, 1,
	1, 2, 5, 1, 1, 0, 0, 2, 2, 2, 2, 1, 1, 0, 0, 1,
	1, 2, 5, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1,
	1, 2, 5, 0, 2, 1, 0, 2, 2, 2, 0, 1, 0, 0, 0, 1,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
];
const defaultRoomData = [
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
	1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
];

export const basicTileEntityPaletteRef = 'urn:sha1:IMPKF5EUH4AW7TCEK4LP66ZTG2DXRH3Q#';

function makeSolidArray<T>(v:T, length:number):T[] {
	let arr:T[] = [];
	for( let i=0; i<length; ++i ) arr.push(v);
	return arr;
}

export function getDefaultRoomTileTreeRef(gdm:GameDataManager, width:number, height:number, depth:number):string {
	return makeTileTreeRef(basicTileEntityPaletteRef, width, height, depth, makeSolidArray(1,width*height*depth), gdm, { infiniteMass: true });
};

//// Tile tree data

const doorFrameBlockData = [
	1,0,0,1,
	1,0,0,1,
	1,0,0,1,
	1,0,0,1,
	0,0,0,0,
	0,0,0,0,
	0,0,0,0,
	0,0,0,0,
	0,0,0,0,
	0,0,0,0,
	0,0,0,0,
	0,0,0,0,
	1,0,0,1,
	1,0,0,1,
	1,0,0,1,
	1,0,0,1,
];
const doorData = [1,1,1];

const UNIT_CUBE :AABB = makeAabb(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5); 
const HUNIT_CUBE:AABB = makeAabb(-0.25, -0.25, -0.25, 0.25, 0.25, 0.25);
const QUNIT_CUBE:AABB = makeAabb(-0.125, -0.125, -0.125, 0.125, 0.125, 0.125);
const EUNIT_CUBE:AABB = makeAabb(-1/16, -1/16, -1/16, 1/16, 1/16, 1/16);
const NORTH_SIDE_BB:AABB = makeAabb(-0.5,-0.5,-0.5, +0.5,+0.5,-0.25);
const EAST_SIDE_BB:AABB = makeAabb(+0.25,-0.5,-0.5, +0.5,+0.5,+0.5);
const WEST_SIDE_BB:AABB = makeAabb(-0.5,-0.5,-0.5, -0.25,+0.5,+0.5);
const TOP_SIDE_BB:AABB = makeAabb(-0.5,-0.5,-0.5, +0.5,-0.25,+0.5);

export const ballEntityClassId   = 'urn:uuid:762f0209-0b91-4084-b1e0-3aac3ca5f5ab';
export const doorFramePieceEntityId = 'urn:uuid:3709e285-3444-420d-9753-ef101fd7924b';
export const doorSegmentEntityClassId = 'urn:uuid:5da4e293-031f-4062-b83f-83241d6768e9';
export const door3EntityClassId  = 'urn:uuid:13a4aa97-7b26-49ee-b282-fc53eccdf9cb';
export const platformSegmentEntityClassId = 'urn:uuid:819f8257-bcad-4d2f-a64e-0a855ad9dd6e';
export const platform3EntityClassId = 'urn:uuid:585927b9-b225-49d7-a49a-dff0445a1f78';
export const tileEntityPaletteId = 'urn:uuid:50c19be4-7ab9-4dda-a52f-cf4cfe2562ac';

export const spawnPointEntityClassId = 'urn:uuid:416bfc18-7412-489f-a45e-6ff4c6a4e08a';
export const playerEntityClassId     = 'urn:uuid:416bfc18-7412-489f-a45e-6ff4c6a4e08b';
export const deadPlayerEntityClassId = 'urn:uuid:416bfc18-7412-489f-a45e-6ff4c6a4e08c';
export const tanRox1EntityClassId    = 'urn:uuid:4513ae98-0f43-4099-a532-6522adc6b6f1';
export const brikEntityClassId       = 'urn:uuid:7164c409-9d00-4d75-8fc6-4f30a5755f77';
export const brownBrikEntityClassId  = 'urn:uuid:7164c409-9d00-4d75-8fc6-4f30a5755f78';
export const blueBrikEntityClassId   = 'urn:uuid:7164c409-9d00-4d75-8fc6-4f30a5755f79';
export const yellowBrikEntityClassId = 'urn:uuid:7164c409-9d00-4d75-8fc6-4f30a5755f7a';
export const redBrikEntityClassId    = 'urn:uuid:7164c409-9d00-4d75-8fc6-4f30a5755f7b';
export const grayBrikEntityClassId   = 'urn:uuid:7164c409-9d00-4d75-8fc6-4f30a5755f7c';
export const bigBrikEntityClassId       = 'urn:uuid:de6fbe4f-a475-46fe-8613-1900d6a5d36c';
export const bigBlueBrikEntityClassId   = 'urn:uuid:6764a015-767e-4403-b565-4fbe94851f0d';
export const bigYellowBrikEntityClassId = 'urn:uuid:6764a015-767e-4403-b565-4fbe94851f0e';
export const bigRedBrikEntityClassId    = 'urn:uuid:6764a015-767e-4403-b565-4fbe94851f0f';
export const plant1EntityClassId         = 'urn:uuid:159aa4e5-016a-473d-9be7-5ba492fa899b';
export const browningPlant1EntityClassId = 'urn:uuid:159aa4e5-016a-473d-9be7-5ba492fa899c';
export const brownPlant1EntityClassId    = 'urn:uuid:159aa4e5-016a-473d-9be7-5ba492fa899d';
export const vines1EntityClassId         = 'urn:uuid:4ee24c8f-7309-462e-b219-ed60505bdb52';
export const browningVines1EntityClassId = 'urn:uuid:4ee24c8f-7309-462e-b219-ed60505bdb53';
export const roots1EntityClassId         = 'urn:uuid:123da2f5-252a-408d-9031-98a7f6639acc';
export const backLadderEntityClassId = 'urn:uuid:80cad088-4875-4fc4-892e-34c3035035cc';
export const doorFrameEntityClassId = 'urn:uuid:fde59aa4-d580-456b-b173-2b65f837fcb0';

export const latticeColumnEntityClassId = 'urn:uuid:601fb61a-df00-49bf-8189-877497cf492f';
export const latticeColumnRightBlockEntityClassId = 'urn:uuid:02056297-7242-4ff2-af15-69055671e5c5';
export const latticeColumnLeftBlockEntityClassId = 'urn:uuid:9bee7432-5ad0-4f9d-9759-9d1a6fa02a85';

export const latticeColumnBgEntityClassId = 'urn:uuid:b64789e4-023c-49ea-98b5-a9d892688bbb';
export const latticeColumnBgRightBlockEntityClassId = 'urn:uuid:c447986a-19d2-447a-ab39-afe9df781dbe';
export const latticeColumnBgLeftBlockEntityClassId = 'urn:uuid:c145afdd-bc60-4c97-bad8-b6fcb3e1846f';
export const toggleBoxOffEntityClassRef      = 'urn:uuid:5f51520a-09c9-4aaa-b0e8-68a03617eaf0';
export const toggleBoxOnEntityClassRef       = 'urn:uuid:5f51520a-09c9-4aaa-b0e8-68a03617eaf1';
export const wiredToggleBoxEntityClassRef    = 'urn:uuid:5f51520a-09c9-4aaa-b0e8-68a03617eaf2';
export const wiredToggleBoxVisualRef         = 'urn:uuid:5f51520a-09c9-4aaa-b0e8-68a03617eaf3';
//export const wiredToggleBoxBlockEntityClassRef = 'urn:uuid:5f51520a-09c9-4aaa-b0e8-68a03617eaf4';
export const verticalEthernetCableEigthClassRef= 'urn:uuid:33419dc3-f0e2-451c-8c07-50d010ac8ea0'; 

export const primarySpawnPointEntityId = 'urn:uuid:d42a8340-ec03-482b-ae4c-a1bfdec4ba3a'; 
export const playerEntityId            = 'urn:uuid:d42a8340-ec03-482b-ae4c-a1bfdec4ba32';
export const ballEntityId        = 'urn:uuid:10070a44-2a0f-41a1-bcfb-b9e16a6f1b59';
export const blueKeyEntityId     = 'urn:uuid:fd1935da-f128-4195-8a13-90fbf59ef3b1';
export const yellowKeyEntityId   = 'urn:uuid:fd1935da-f128-4195-8a13-90fbf59ef3b2';
export const door3EntityId       = 'urn:uuid:1a8455be-8cce-4721-8ccb-7f5644e30081';
export const platformEntityId    = 'urn:uuid:27c27635-99ba-4ef3-b3ff-445eb9b132e5';
export const platformSwitchEntityId = 'urn:uuid:f2d3556d-2d46-4628-85d9-dd82b017a5fb';
const room1TileTreeId     = 'urn:uuid:a11ed6ae-f096-4b30-bd39-2a78d39a1381';
const room2TileTreeId     = 'urn:uuid:a11ed6ae-f096-4b30-bd39-2a78d39a1382';
const room3TileTreeId     = 'urn:uuid:a11ed6ae-f096-4b30-bd39-2a78d39a1383';


export const blueKeyEntityClassId   = 'urn:uuid:f2f4bea7-7a6a-45af-9a70-83c7ce58ba31';
export const redKeyEntityClassId    = 'urn:uuid:f2f4bea7-7a6a-45af-9a70-83c7ce58ba32';
export const yellowKeyEntityClassId = 'urn:uuid:f2f4bea7-7a6a-45af-9a70-83c7ce58ba33';
export const triforceEntityClassId  = 'urn:uuid:849d75c9-ab5b-476f-9192-c87601d40de0';
export const appleEntityClassId     = 'urn:uuid:6048f9b8-f5bf-414a-b439-3f812e1ad31a';
export const stick1EntityClassId    = 'urn:uuid:4f3fd5b7-b51e-4ae7-9673-febed16050c1';
export const stick2EntityClassId    = 'urn:uuid:4f3fd5b7-b51e-4ae7-9673-febed16050c2';
export const vomitChunk1EntityClassId= 'urn:uuid:8025cb25-4797-48ef-9500-78f202f074ea';
export const vomitChunk2EntityClassId= 'urn:uuid:8025cb25-4797-48ef-9500-78f202f074eb';
export const vomitChunk3EntityClassId= 'urn:uuid:8025cb25-4797-48ef-9500-78f202f074ec';

export const cheapBlueDoorEntityClassId   = 'urn:uuid:0575864a-e0d0-4fa4-b84a-a724a66dcb61';
export const cheapRedDoorEntityClassId    = 'urn:uuid:0575864a-e0d0-4fa4-b84a-a724a66dcb62';
export const cheapYellowDoorEntityClassId = 'urn:uuid:0575864a-e0d0-4fa4-b84a-a724a66dcb63';

export const keyDoorClassRefs = {
	blueKeyEntityClassId: cheapBlueDoorEntityClassId,
	yellowKeyEntityClassId: cheapYellowDoorEntityClassId,
	redKeyEntityClassId: cheapRedDoorEntityClassId,	
}
export const keyClassRefs  = [
	blueKeyEntityClassId,
	yellowKeyEntityClassId,
	redKeyEntityClassId,
]

function makeEthernetNetwork(
	pos0:Vector3D, dir0:Vector3D,
	pos1:Vector3D, dir1:Vector3D
):ConductorNetwork {
	const builder = new ConductorNetworkBuilder();
	const medIdx = builder.addMediumRef(XMSN_COPPER);
	const n0Idx = builder.addNode(pos0,dir0);
	const n1Idx = builder.addNode(pos1,dir1);
	builder.link(n0Idx, n1Idx, {
		mediumIndex: medIdx,
		crossSectionalArea: 1/(128*128),
		length: 1/8,
	});
	return deepFreeze(builder.network);
}

/**
 * Returns a promise for the new game data root node URI
 */
export function initData( gdm:GameDataManager ):Promise<void> {
	const doorFrameBlockEntityPaletteRef = makeTileEntityPaletteRef([
		null,
		doorFramePieceEntityId,
	], gdm);
	
	const doorEntityPaletteRef = makeTileEntityPaletteRef([
		null,
		doorSegmentEntityClassId,
	], gdm);
	
	const platformEntityPaletteRef = makeTileEntityPaletteRef([
		null,
		platformSegmentEntityClassId,
	], gdm);
	
	gdm.tempStoreObject<EntityClass>( {
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   QUNIT_CUBE,
		physicalBoundingBox: QUNIT_CUBE,
		visualBoundingBox:   QUNIT_CUBE,
		isSolid: true,
		mass: 10,
		opacity: 1,
		climbability: 1/16,
		visualRef: doorFrameImgRef
	}, doorFramePieceEntityId );
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "rocks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox:   UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: tanRox1ImgRef
	}, tanRox1EntityClassId );
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "big blue bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox:   UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: bigBlueBrikImgRef
	}, bigBlueBrikEntityClassId );
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "big yellow bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox:   UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: bigYellowBrikImgRef
	}, bigYellowBrikEntityClassId );
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "big red bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox:   UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: bigRedBrikImgRef
	}, bigRedBrikEntityClassId );
	
	const leftHandAttachmentZoneKey = 'urn:uuid:aed817b0-e381-400e-9797-ce9bff56d76d';
	const rightHandAttachmentZoneKey = 'urn:uuid:8e39b8de-5f0f-4312-889b-d053bdc22649';
	const playerHandAttachmentZoneClassRef = 'urn:uuid:9ba873f6-eb7b-4f21-859f-9eba85a724c8';
	
	gdm.tempStoreObject<AttachmentZoneClass>( {
		attachmentZoneTypeRef: AZTYPE_HAND
	}, playerHandAttachmentZoneClassRef);
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "spawn point",
		structureType: StructureType.NONE,
		tilingBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
	}, spawnPointEntityClassId);
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "player",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: makeAabb(-0.25, -0.25, -0.25, 0.25, 0.5, 0.25),
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		isAffectedByGravity: true,
		mass: 45, // 100 lbs; he's a small guy
		bounciness: 1/64,
		visualRef: playerImgRef,
		maxFlyingForce: 100,
		maxClimbForce: 1000,
		normalWalkingSpeed: 4,
		normalClimbingSpeed: 2,
		climbingSkill: 0.5,
		maxJumpImpulse: 300,
		attachmentZoneClasseRefs: {
			[leftHandAttachmentZoneKey]: playerHandAttachmentZoneClassRef,
			[rightHandAttachmentZoneKey]: playerHandAttachmentZoneClassRef,
		},
		maze1InventorySize: 4,
	}, playerEntityClassId );
	const deadPlayerPhysicalBoundingBox = makeAabb(-0.25, -0.125, -0.25, +0.25, +0.125, +0.25);
	const deadPlayerVisualBoundingBox = makeAabb(-0.5, -0.5+0.125, -0.25, +0.5, +0.125, +0.25);
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "dead player",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: deadPlayerPhysicalBoundingBox,
		visualBoundingBox: deadPlayerVisualBoundingBox,
		isSolid: true,
		isAffectedByGravity: true,
		mass: 45, // 100 lbs; he's a small guy
		bounciness: 1/64,
		visualRef: deadPlayerImgRef,
	}, deadPlayerEntityClassId );

	gdm.tempStoreObject<EntityClass>({
		debugLabel: "bouncy ball",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: HUNIT_CUBE,
		physicalBoundingBox: HUNIT_CUBE,
		visualBoundingBox: HUNIT_CUBE,
		isSolid: true,
		isAffectedByGravity: true,
		mass: 10,
		bounciness: 1,
		opacity: 0.25,
		visualRef: ballImgRef
	}, ballEntityClassId );
	
	const platformSegmentBounds = makeAabb(-0.25,-0.25,-0.5, +0.25,+0.25,+0.5);
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "platform segment",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   platformSegmentBounds,
		physicalBoundingBox: platformSegmentBounds,
		visualBoundingBox:   platformSegmentBounds,
		isSolid: true,
		mass: 20,
		opacity: 0.5,
		visualRef: platformSegmentImgRef
	}, platformSegmentEntityClassId );
	
	const platform3Bounds = makeAabb(-1.5,-0.25,-0.5, +1.5,+0.25,+0.5);
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "1.5m-wide platform",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: platform3Bounds,
		physicalBoundingBox: platform3Bounds,
		visualBoundingBox: platform3Bounds,
		xDivisions: 6,
		yDivisions: 1,
		zDivisions: 1,
		opacity: 0.5,
		childEntityPaletteRef: platformEntityPaletteRef,
		childEntityIndexes: [1,1,1,1,1,1],
		mass: 120,
		isAffectedByGravity: true,
		normalClimbingSpeed: 4,
		climbingSkill: 15/16,
		maxClimbForce: 5000,
	}, platform3EntityClassId);
	
	const doorSegmentBounds = makeAabb(-0.25,-0.5,-0.5, +0.25,+0.5,+0.5);
	const doorSegmentVizBounds = makeAabb(-5/16,-0.5,-0.5, +5/16,+0.5,+0.5);
	// It is a little wider visually so that it always occludes things!
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "door segment",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox:   doorSegmentBounds,
		physicalBoundingBox: doorSegmentBounds,
		visualBoundingBox:   doorSegmentVizBounds,
		isSolid: true,
		mass: 40,
		opacity: 1,
		visualRef: doorSegmentImgRef
	}, doorSegmentEntityClassId );
	
	const door3Bounds = makeAabb(-0.25,-1.5,-0.5, +0.25,+1.5,+0.5);
	const door3VisBounds = makeAabb(-5/16,-1.5,-0.5, +5/16,+1.5,+0.5);
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "3-segment vertical door",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: door3Bounds,
		physicalBoundingBox: door3Bounds,
		visualBoundingBox: door3VisBounds,
		xDivisions: 1,
		yDivisions: 3,
		zDivisions: 1,
		opacity: 1, // should be 1; smaller for testing
		childEntityPaletteRef: doorEntityPaletteRef,
		childEntityIndexes: [1,1,1],
		mass: 120,
		isAffectedByGravity: true,
		normalClimbingSpeed: 4,
		maxClimbForce: 3000,
		climbingSkill: 15/16, // So it can climb the frames!
	}, door3EntityClassId);
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "light gray bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: brikImgRef
	}, brikEntityClassId );
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "brown bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: brownBrikImgRef
	}, brownBrikEntityClassId );
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "blue bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: blueBrikImgRef
	}, blueBrikEntityClassId );
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "yellow bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: yellowBrikImgRef
	}, yellowBrikEntityClassId );
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "red bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: redBrikImgRef
	}, redBrikEntityClassId );
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "gray bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: grayBrikImgRef
	}, grayBrikEntityClassId );
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "big bricks",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: true,
		opacity: 1,
		visualRef: bigBrikImgRef
	}, bigBrikEntityClassId )
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "plant",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: false,
		opacity: 0.25,
		visualRef: plant1ImgRef
	}, plant1EntityClassId );
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "browning plant",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: false,
		opacity: 0.25,
		visualRef: browningPlant1ImgRef
	}, browningPlant1EntityClassId );
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "plant",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: false,
		opacity: 0.125,
		visualRef: brownPlant1ImgRef
	}, brownPlant1EntityClassId );
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "vines",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: false,
		opacity: 3/4,
		visualRef: vines1ImgRef
	}, vines1EntityClassId );
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "browning vines",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: false,
		opacity: 3/4,
		visualRef: browningVines1ImgRef
	}, browningVines1EntityClassId );
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "roots",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		isSolid: false,
		opacity: 1/2,
		visualRef: roots1ImgRef
	}, roots1EntityClassId );
	
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "door frame",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		xDivisions: 4,
		yDivisions: 4,
		zDivisions: 4,
		opacity: 0,
		childEntityPaletteRef: doorFrameBlockEntityPaletteRef,
		childEntityIndexes: doorFrameBlockData
	}, doorFrameEntityClassId );

	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "ladder (+Z)",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: NORTH_SIDE_BB,
		visualBoundingBox: UNIT_CUBE,
		opacity: 0.125,
		climbability: 0.75,
		isSolid: true,
		visualRef: ladder1FrontImgRef,
	}, backLadderEntityClassId );

	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "small lattice column",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: HUNIT_CUBE,
		physicalBoundingBox: HUNIT_CUBE,
		visualBoundingBox: HUNIT_CUBE,
		isSolid: true,
		opacity: 1/4,
		climbability: 1/16,
		visualRef: latticeColumnImgRef
	}, latticeColumnEntityClassId);
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "small lattice column block (+x)",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		xDivisions: 2,
		yDivisions: 2,
		zDivisions: 2,
		childEntityPaletteRef: makeTileEntityPaletteRef([null, latticeColumnEntityClassId], gdm),
		childEntityIndexes: [0,1,0,1,0,1,0,1]
	}, latticeColumnRightBlockEntityClassId );
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "small lattice column block (-x)",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		xDivisions: 2,
		yDivisions: 2,
		zDivisions: 2,
		childEntityPaletteRef: makeTileEntityPaletteRef([null, latticeColumnEntityClassId], gdm),
		childEntityIndexes: [1,0,1,0,1,0,1,0]
	}, latticeColumnLeftBlockEntityClassId );
	
	const bgLatticeBounds = makeAabb(-0.25,-0.25,-0.125, +0.25,+0.25,+0.125);
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "small lattice column (background)",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: bgLatticeBounds,
		physicalBoundingBox: bgLatticeBounds,
		visualBoundingBox: bgLatticeBounds,
		isSolid: true,
		opacity: 1/4,
		climbability: 1/16,
		visualRef: latticeColumnBgImgRef
	}, latticeColumnBgEntityClassId);
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "small lattice column block (+x)",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		xDivisions: 2,
		yDivisions: 2,
		zDivisions: 4,
		childEntityPaletteRef: makeTileEntityPaletteRef([null, latticeColumnBgEntityClassId], gdm),
		childEntityIndexes: [0,1,0,1,0,0,0,0,0,0,0,0,0,1,0,1]
	}, latticeColumnBgRightBlockEntityClassId );
	gdm.tempStoreObject<TileTree>( {
		debugLabel: "small lattice column block (-x)",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		xDivisions: 2,
		yDivisions: 2,
		zDivisions: 4,
		childEntityPaletteRef: makeTileEntityPaletteRef([null, latticeColumnBgEntityClassId], gdm),
		childEntityIndexes: [1,0,1,0,0,0,0,0,0,0,0,0,1,0,1,0]
	}, latticeColumnBgLeftBlockEntityClassId );
	
	const toggleBoxBb = makeAabb(-1/4,-1/4,-1/8, +1/4,+1/4,+1/8); 
	
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "toggle box (off)",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: toggleBoxBb,
		physicalBoundingBox: toggleBoxBb,
		visualBoundingBox: toggleBoxBb,
		visualRef: toggleBoxOffImgRef,
		defaultSubsystems: {
			"button": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/Button",
				pokedExpressionRef: sExpressionToProgramExpressionRef(
					['progn',
						['sendBusMessage', ['makeArray', '/morph', toggleBoxOnEntityClassRef]],
						['sendBusMessage', ['makeArray', '/onon']]],
					gdm
				)
			},
			"onon": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/SimpleComputer"
			},
			"onoff": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/SimpleComputer"
			},
			"morph": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/EntityMorpher",
			}
		}
	}, toggleBoxOffEntityClassRef);
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "toggle box (on)",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: toggleBoxBb,
		physicalBoundingBox: toggleBoxBb,
		visualBoundingBox: toggleBoxBb,
		visualRef: toggleBoxOnImgRef,
		defaultSubsystems: {
			"button": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/Button",
				pokedExpressionRef: sExpressionToProgramExpressionRef(
					['progn',
						['sendBusMessage', ['makeArray', '/morph', toggleBoxOffEntityClassRef]],
						['sendBusMessage', ['makeArray', '/onoff']]],
					gdm
				)
			},
			"onon": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/SimpleComputer"
			},
			"onoff": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/SimpleComputer"
			},
			"morph": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/EntityMorpher",
			}
		}
	}, toggleBoxOnEntityClassRef);
	const toggleBoxBlockEntityClassRef = gdm.tempStoreObject<TileTree>( {
		debugLabel: "toggle box block",
		structureType: StructureType.TILE_TREE,
		tilingBoundingBox: UNIT_CUBE,
		physicalBoundingBox: UNIT_CUBE,
		visualBoundingBox: UNIT_CUBE,
		xDivisions: 2,
		yDivisions: 2,
		zDivisions: 4,
		childEntityPaletteRef: makeTileEntityPaletteRef([null, toggleBoxOffEntityClassRef, toggleBoxOnEntityClassRef], gdm),
		childEntityIndexes: [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,1,1,1],
	});
	
	// TODO: Do onon/onoff action when 1/0 message received from netdown
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "wired toggle box",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: toggleBoxBb,
		physicalBoundingBox: toggleBoxBb,
		visualBoundingBox: toggleBoxBb,
		visualRef: wiredToggleBoxVisualRef,
		defaultSubsystems: {
			"button": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/Button",
				pokedExpressionRef: sExpressionToProgramExpressionRef(
					['progn',
						['sesv', 'switchState',
							['!', ['coalesce', ['gesv', 'switchState'], false]]],
						['sendBusMessage', ['makeArray', '/netup/signal', ['makeArray',
							['if', ['gesv', 'switchState'], 1, 0]]]],
						['trace', ['gesv', 'switchState']]],
					gdm
				)
			},
			"netup": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/WiredNetworkPort",
				position: {x:+1/16, y:-1/4, z:-1/16},
				direction: {x:0, y:-1, z:0},
				channelId: CHAN_SNS,
				transmissionMediumRef: XMSN_COPPER,
				normalTransmissionPower: 1, // whatever!
			},
			"netdown": {
				classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/WiredNetworkPort",
				position: {x:+1/16, y:+1/4, z:-1/16},
				direction: {x:0, y:+1, z:0},
				channelId: CHAN_SNS,
				transmissionMediumRef: XMSN_COPPER,
				normalTransmissionPower: 1, // whatever!
				messageReceivedExpressionRef: sExpressionToProgramExpressionRef(
					['sesv', 'switchState',
						['!=', [['var', 'payload'], 0], 0]],
					gdm
				)
			},
		}
	}, wiredToggleBoxEntityClassRef);
	
	gdm.tempStoreObject<EntityClass>({
		tilingBoundingBox:   EUNIT_CUBE,
		physicalBoundingBox: EUNIT_CUBE,
		visualBoundingBox:   EUNIT_CUBE,
		structureType: StructureType.INDIVIDUAL,
		visualRef: eighthMeterWireImgRef,
		defaultSubsystems: {
			"ethcable": makeEthernetNetwork(
				{x:0,y:-1/16,z:0}, {x:0,y:-1,z:0},
				{x:0,y:+1/16,z:0}, {x:0,y:+1,z:0}
			),
		}
	}, verticalEthernetCableEigthClassRef);
	const verticalEthernetQuarterlockRef = makeTileTreeRef(
		[null, verticalEthernetCableEigthClassRef],
		2,2,2,[
			1,0,1,0,
			0,0,0,0,
		],gdm);
	/* 0.5x0.5x0.25 */
	const verticalEthernetHalfSlabRef = makeTileTreeRef(
		[null, verticalEthernetQuarterlockRef],
		2,2,1,[
			0,1,0,1,
		],gdm);
	const verticalEthernetHalfBlockRef = makeTileTreeRef(
		[null, verticalEthernetQuarterlockRef],
		2,2,2,[
			0,0,0,0,
			0,1,0,1,
		],gdm);
	const verticalEthernetBlockRef = makeTileTreeRef(
		[null, verticalEthernetHalfBlockRef],
		2,2,2,[
			0,0,0,0,
			1,0,1,0,
		],gdm);
	
	const wiredTottleBoxBlockPaletteRef = makeTileEntityPaletteRef([
		null,
		{
			entity: {
				classRef: wiredToggleBoxEntityClassRef,
				state: {
					'switchState': false
				}
			}
		},
		{
			entity: {
				classRef: wiredToggleBoxEntityClassRef,
				state: {
					'switchState': true
				}
			}
		},
		verticalEthernetHalfSlabRef
	], gdm);
	const wiredToggleBoxBlockEntityClassRef = makeTileTreeRef(
		wiredTottleBoxBlockPaletteRef, 2, 2, 4,
		[0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
		gdm
	);
	const wiredToggleBoxWithBottomCableBlockEntityClassRef = makeTileTreeRef(
		wiredTottleBoxBlockPaletteRef, 2, 2, 4,
		[0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,3,0],
		gdm
	);
	
	const keyBoundingBox = makeAabb(-0.25,-0.125,-0.125, +0.25,+0.125,+0.125);
	const cheapDoorBoundingBox = makeAabb(-0.25,-0.5,-0.5, +0.25,+0.5,+0.5);

	const keyColors = ["blue", "yellow", "red"];
	const keyClassRefs = [blueKeyEntityClassId, yellowKeyEntityClassId, redKeyEntityClassId];
	const keyVisualRefs = [blueKeyImgRef, yellowKeyImgRef, redKeyImgRef];
	const cheapDoorClassRefs = [cheapBlueDoorEntityClassId, cheapYellowDoorEntityClassId, cheapRedDoorEntityClassId]
	const cheapDoorVisualRefs = [cheapBlueDoorImgRef, cheapYellowDoorImgRef, cheapRedDoorImgRef];
	for( let i=0; i<keyClassRefs.length; ++i ) {
		gdm.tempStoreObject<EntityClass>( {
			debugLabel: keyColors[i]+" key",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: HUNIT_CUBE,
			physicalBoundingBox: keyBoundingBox,
			visualBoundingBox: keyBoundingBox,
			isMaze1AutoPickup: true,
			isAffectedByGravity: true,
			isSolid: true,
			mass: 0.25, // It's a big key
			coefficientOfFriction: 0.65,
			visualRef: keyVisualRefs[i],
			maze1Importance: 2,
		}, keyClassRefs[i]);
		gdm.tempStoreObject<EntityClass>( {
			debugLabel: "cheap "+keyColors[i]+"-lock door",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: HUNIT_CUBE,
			physicalBoundingBox: doorSegmentBounds,
			visualBoundingBox: doorSegmentVizBounds,
			visualRef: cheapDoorVisualRefs[i],
			opacity: 0.5,
			cheapMaze1DoorKeyClassRef: keyClassRefs[i],
		}, cheapDoorClassRefs[i]);
	}
	const triforceBoundingBox = makeAabb(-8/16, -6/16, -8/16, +8/16, +6/16, +8/16);
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "triforce",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: HUNIT_CUBE,
		physicalBoundingBox: triforceBoundingBox,
		visualBoundingBox: triforceBoundingBox,
		isMaze1AutoPickup: true,
		isAffectedByGravity: true,
		isSolid: true,
		mass: 0.25, // It's an average triforce
		visualRef: triforceImgRef,
		maze1Importance: 3,
	}, triforceEntityClassId);
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "apple",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: HUNIT_CUBE,
		physicalBoundingBox: HUNIT_CUBE,
		visualBoundingBox: HUNIT_CUBE,
		isMaze1AutoPickup: true,
		isAffectedByGravity: true,
		isSolid: true,
		mass: 0.25,
		coefficientOfFriction: 0.25,
		visualRef: appleImgRef,
		isMaze1Edible: true,
		maze1NutritionalValue: 10000 // Not realistic!  Realistic value:  397480 joules (95 kilocalories)
	}, appleEntityClassId);
	const stickVisualBoundingBox = makeAabb(-0.25, -0.25, -0.125, +0.25, +0.125, +0.125);
	const stickPhysicalBoundingBox = makeAabb(-0.25, -0.125, -0.125, +0.25, +0.125, +0.125);
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "stick",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: HUNIT_CUBE,
		physicalBoundingBox: stickPhysicalBoundingBox,
		visualBoundingBox: stickVisualBoundingBox,
		isMaze1AutoPickup: true,
		isAffectedByGravity: true,
		isSolid: true,
		mass: 0.25,
		coefficientOfFriction: 0.75,
		visualRef: stick1ImgRef,
		maze1Importance: 0,
	}, stick1EntityClassId);
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "stick",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: HUNIT_CUBE,
		physicalBoundingBox: stickPhysicalBoundingBox,
		visualBoundingBox: stickVisualBoundingBox,
		isMaze1AutoPickup: true,
		isAffectedByGravity: true,
		isSolid: true,
		mass: 0.25,
		coefficientOfFriction: 0.75,
		visualRef: stick2ImgRef,
		maze1Importance: 0,
	}, stick2EntityClassId);
	
	const chunkBb = makeAabb(-1/8, -1/16, -1/8, +1/8, +1/16, +1/8);
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "vomit chunk",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: chunkBb,
		physicalBoundingBox: chunkBb,
		visualBoundingBox: chunkBb,
		isAffectedByGravity: true,
		isSolid: true,
		mass: 1/32,
		coefficientOfFriction: 0.75,
		visualRef: vomitChunk1ImgRef,
		isMaze1AutoPickup: true,
		isMaze1Edible: true,
		maze1NutritionalValue: 10
	}, vomitChunk1EntityClassId);
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "vomit chunk",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: chunkBb,
		physicalBoundingBox: chunkBb,
		visualBoundingBox: chunkBb,
		isAffectedByGravity: true,
		isSolid: true,
		mass: 1/32,
		coefficientOfFriction: 0.75,
		visualRef: vomitChunk2ImgRef,
		isMaze1AutoPickup: true,
		isMaze1Edible: true,
		maze1NutritionalValue: 10
	}, vomitChunk2EntityClassId);
	gdm.tempStoreObject<EntityClass>( {
		debugLabel: "vomit chunk",
		structureType: StructureType.INDIVIDUAL,
		tilingBoundingBox: chunkBb,
		physicalBoundingBox: chunkBb,
		visualBoundingBox: chunkBb,
		isAffectedByGravity: true,
		isSolid: true,
		mass: 1/32,
		coefficientOfFriction: 0.75,
		visualRef: vomitChunk3ImgRef,
		isMaze1AutoPickup: true,
		isMaze1Edible: true,
		maze1NutritionalValue: 10
	}, vomitChunk3EntityClassId);
	
	const regularTileEntityPaletteRef = makeTileEntityPaletteRef( [
		null,
		brikEntityClassId,
		bigBrikEntityClassId,
		plant1EntityClassId,
		/* 4: */ doorFrameEntityClassId,
		/* 5: */ backLadderEntityClassId,
		/* 6: */ gdm.tempStoreObject<EntityClass>( {
			debugLabel: "ladder (+X)",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: UNIT_CUBE,
			physicalBoundingBox: EAST_SIDE_BB,
			visualBoundingBox: EAST_SIDE_BB,
			opacity: 0.125,
			climbability: 0.75,
			isSolid: true,
			visualRef: ladder1SideImgRef,
		}),
		/* 7: */ gdm.tempStoreObject<EntityClass>( {
			debugLabel: "ladder (-X)",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: UNIT_CUBE,
			physicalBoundingBox: WEST_SIDE_BB,
			visualBoundingBox: WEST_SIDE_BB,
			opacity: 0.125,
			climbability: 0.75,
			isSolid: true,
			visualRef: ladder1SideImgRef,
		}),
		/* 8 */ vines1EntityClassId,
		/* 9: */ gdm.tempStoreObject<EntityClass>( {
			debugLabel: "ladder (-Y)",
			structureType: StructureType.INDIVIDUAL,
			tilingBoundingBox: UNIT_CUBE,
			physicalBoundingBox: TOP_SIDE_BB,
			visualBoundingBox: TOP_SIDE_BB,
			opacity: 0.125,
			climbability: 0.75,
			isSolid: true,
			visualRef: ladder1TopImgRef,
		}),
		/* 10 */ latticeColumnRightBlockEntityClassId,
		/* 11 */ latticeColumnLeftBlockEntityClassId,
		/* 12 */ latticeColumnBgRightBlockEntityClassId,
		/* 13 */ latticeColumnBgLeftBlockEntityClassId,
		/* 14 */ brownBrikEntityClassId,
		/* 15 */ blueBrikEntityClassId,
		/* 16 */ cheapBlueDoorEntityClassId,
		/* 17 */ cheapYellowDoorEntityClassId,
		/* 18 */ cheapRedDoorEntityClassId,
		/* 19 */ yellowBrikEntityClassId,
		/* 20 */ redBrikEntityClassId,
		/* 21 */ grayBrikEntityClassId,
		/* 22 */ bigBlueBrikEntityClassId,
		/* 23 */ bigYellowBrikEntityClassId,
		/* 24 */ bigRedBrikEntityClassId,
		/* 25 */ browningPlant1EntityClassId,
		/* 26 */ brownPlant1EntityClassId,
		/* 27 */ browningVines1EntityClassId,
		/* 28 */ roots1EntityClassId,
		/* 29 */ tanRox1EntityClassId,
		/* 30 */ toggleBoxBlockEntityClassRef,
		/* 31 */ wiredToggleBoxBlockEntityClassRef,
		/* 32 */ verticalEthernetBlockRef,
		/* 33 */ wiredToggleBoxWithBottomCableBlockEntityClassRef,
	], gdm, tileEntityPaletteId);
	
	// do this as second step because we need to reference that tile tree palette by ID
	const roomBounds = makeAabb(-8, -8, -0.5, 8, 8, 0.5);
	
	gdm.tempStoreObject<Room>({
		bounds: roomBounds,
		roomEntities: {
			[playerEntityId]: {
				position: makeVector(-4.5, -2.5, 0),
				entity: {
					id: playerEntityId,
					classRef: playerEntityClassId,
					desiresMaze1AutoActivation: true,
				},
			},
			[blueKeyEntityId]: {
				position: makeVector(-3.5, -1.5, 0),
				entity: {
					classRef: blueKeyEntityClassId
				}
			},
			['the-triforce']: {
				position: makeVector(-2.5, +0.5, 0),
				entity: {
					classRef: triforceEntityClassId
				}
			},
			[room1TileTreeId]: {
				position: makeVector(0,0,0),
				entity: {
					classRef: makeTileTreeRef( regularTileEntityPaletteRef, 16, 16, 1, room1Data, gdm, { infiniteMass: true } )
				}
			},
			[ballEntityId]: {
				position: makeVector(-2.5, -3.5, 0),
				entity: {
					classRef: ballEntityClassId
				}
			},
			[yellowKeyEntityId]: {
				position: makeVector(-1.5, -3.5, 0),
				entity: {
					classRef: yellowKeyEntityClassId
				}
			},
			[platformEntityId]: {
				position: makeVector(6, 0, 0),
				entity: {
					classRef: platform3EntityClassId,
					desiredMovementDirection: makeVector(0, -1.0, 0),
				}
			},
			[platformSwitchEntityId]: {
				position: makeVector(3.5, -1.5, +3/8),
				entity: {
					classRef: toggleBoxOnEntityClassRef,
					subsystems: {
						"onon": {
							"classRef": "http://ns.nuke24.net/Game21/EntitySubsystem/SimpleComputer",
							messageReceivedExpressionRef: sExpressionToProgramExpressionRef(
								['sendBusMessage', ['makeArray', '/liftlink/desiredmovementdirection', 0, -1, 0]],
								gdm
							)
						},
						"onoff": {
							"classRef": "http://ns.nuke24.net/Game21/EntitySubsystem/SimpleComputer",
							messageReceivedExpressionRef: sExpressionToProgramExpressionRef(
								['sendBusMessage', ['makeArray', '/liftlink/desiredmovementdirection', 0, +1, 0]],
								gdm
							)
						},
						"liftlink": {
							classRef: "http://ns.nuke24.net/Game21/EntitySubsystem/InterEntityBusBridge",
							forwardEntityPath: [ROOMID_FINDENTITY, platformEntityId]
						}
					}
				}
			}
		},
		neighbors: {
			"w": {
				offset: makeVector(-16, 0, 0),
				bounds: roomBounds,
				roomRef: room2Id
			},
			"e": {
				offset: makeVector(+16, 0, 0),
				bounds: roomBounds,
				roomRef: room2Id					
			},
			"n": {
				offset: makeVector(0, -16, 0),
				bounds: roomBounds,
				roomRef: room3Id,
			},
			"2": {
				offset: makeVector(0, +16, 0),
				bounds: roomBounds,
				roomRef: room3Id,
			},
		}
	}, room1Id);
	
	gdm.tempStoreObject<Room>({
		bounds: roomBounds,
		roomEntities: {
			[room2TileTreeId]: {
				position: makeVector(0,0,0),
				entity: {
					classRef: makeTileTreeRef( regularTileEntityPaletteRef, 16, 16, 1, room2Data, gdm, { infiniteMass: true } )
				}
			},
			[door3EntityId]: {
				position: makeVector(-1.5,+1.5,0),
				entity: {
					classRef: door3EntityClassId
				}
			},
		},
		neighbors: {
			"w": {
				offset: makeVector(-16, 0, 0),
				bounds: roomBounds,
				roomRef: room1Id
			},
			"e": {
				offset: makeVector(+16, 0, 0),
				bounds: roomBounds,
				roomRef: room1Id
			},
		}
	}, room2Id);
	
	gdm.tempStoreObject<Room>({
		bounds: roomBounds,
		roomEntities: {
			[room3TileTreeId]: {
				position: makeVector(0,0,0),
				entity: {
					classRef: makeTileTreeRef( regularTileEntityPaletteRef, 16, 16, 1, room3Data, gdm, { infiniteMass: true } )
				}
			}
		},
		neighbors: {
			"n": {
				offset: makeVector(0, -16, 0),
				bounds: roomBounds,
				roomRef: room1Id,
			},
			"s": {
				offset: makeVector(0, +16, 0),
				bounds: roomBounds,
				roomRef: room1Id,
			},
		}
	}, room3Id);
	
	return Promise.resolve();
}

import { sha1Urn } from '../tshash/index';
import Datastore from './Datastore';
import HTTPHashDatastore from './HTTPHashDatastore';

if( typeof require != 'undefined' && typeof module != 'undefined' && require.main === module ) {
	const dataIdent = sha1Urn;
	const ds:Datastore<Uint8Array> = HTTPHashDatastore.createDefault();
	const gdm:GameDataManager = new GameDataManager(ds);
	initData(gdm).then( () => gdm.flushUpdates() ).then( (rootNodeUri) => {
		const saveGame = {
			gameDataRef: rootNodeUri,
			rootRoomId: room1Id,
			playerId: playerEntityId
		};
		return gdm.storeObject(saveGame).then( (saveRef) => {
			console.log(saveRef);
		});
	}).catch( (err) => {
		console.error("Error generating initial savegame", err)
	});
}
