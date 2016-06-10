
/*
 * Let's simulate a
 * 10-meter long belt with 5
 * 1-meter items on it (two of them represented by a single item object with repetition=2)
 *
 * |-a-bb-c-d-|
 *
 * It's moving at +1m/s (that's to the left)
 *
 * The origin starts at...let's say 5.
 */

import {
	ConveyorBeltItem,
	ConveyorBeltSegment,
	ConveyorBeltUpdateContext,
	updateBeltSegment
} from './conveyorbelt';

function eachSubItem<P>( item:ConveyorBeltItem<P>, callback:(item:ConveyorBeltItem<P>, headPosition:number)=>void ) {
	for( let i=0; i < item.repetitions; ++i ) {
		callback( item, item.headPosition + item.subSpan * i );
	}
}
function eachSegmentItem<P>( seg:ConveyorBeltSegment<P>, callback:(item:ConveyorBeltItem<P>)=>void ) {
	seg.headBackupGroup.items.forEach( callback );
	seg.movingItems.forEach( callback );
	seg.tailBackupGroup.items.forEach( callback );
}

function segmentString( seg:ConveyorBeltSegment<string>, resolution:number ):string {
	var drawn = 0;
	var output : string = "";
	eachSegmentItem( seg, (item) => {
		eachSubItem( item, (item,pos) => {
			const absHeadPos = Math.round(resolution * (seg.beltOriginPosition + pos               ));
			const absTailPos = Math.round(resolution * (seg.beltOriginPosition + pos + item.subSpan));
			
			while( drawn < absHeadPos ) { output += "-"; drawn += 1; }
			const symbol = item.payload.substring(0,1);
			while( drawn < absTailPos ) { output += symbol; drawn += 1; }
		} );
	} );
	const absSegEnd = Math.round(seg.segmentLength * resolution);
	while( drawn < absSegEnd ) { output += "-"; drawn += 1; }
	return output;
}

function addItem( seg:ConveyorBeltSegment<string>, p:string, reps:number, headPosition:number ) {
	seg.movingItems.push( {
		headPosition: headPosition,
		subSpan: 1,
		repetitions: reps,
		payload: p,
		payloadRef: "test:"+p
	} );
}

function assertSegmentEquals(a:string, segment:ConveyorBeltSegment<string>, resolution:number, message?:string):void {
	const b:string = segmentString(segment, resolution);
	if( a != b ) {
		throw new Error("["+a+"] != ["+b+"]"+(message ? "; "+message : ""));
	}
}

function setUpSegment():ConveyorBeltSegment<string> {
	var ts = 0;
	const seg : ConveyorBeltSegment<string> = {
		timestamp: 0,
		beltOriginPosition: 5,
		beltSpeed: 1,
		segmentLength: 10,
		headBackupGroup: {
			headPosition: -5,
			tailPosition: -5,
			items: [],
		},
		movingItems: [],
		tailBackupGroup: {
			headPosition: +5,
			tailPosition: +5,
			items: [],
		},
	}
	addItem( seg, "a", 1, -4 );
	addItem( seg, "b", 2, -2 );
	addItem( seg, "c", 1,  1 );
	addItem( seg, "d", 1,  3 );
	
	return seg;
}

{
	const seg = setUpSegment();
	assertSegmentEquals( "--aa--bbbb--cc--dd--", seg, 2 );
}

declare namespace NodeJS {
	interface WritableStream {
		write( str:string ):boolean;
	}
	interface Process {
		stderr: WritableStream;
	}
}
declare var process : NodeJS.Process;

{
	const seg = setUpSegment();
	const displayRes = 2;
	process.stderr.write( segmentString(seg, displayRes) + "\r" );
	const ctx:ConveyorBeltUpdateContext<string> = {
		spaceAtHead: 0,
		spaceAtTail: 0,
		removedFromHead: [],
		removedFromTail: []
	};
	let t = 0;
	setInterval( () => {
		t -= 0.5;
		updateBeltSegment( seg, t, ctx );
		process.stderr.write( segmentString(seg, displayRes) + "\r" );
	}, 200 );
	//process.stderr.write("\n");
}
