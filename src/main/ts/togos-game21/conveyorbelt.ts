// Data structure for efficiently simulating
// Factorio-style transport belts

// TODO: Replace this implementation with:
// - All items on the belt are in a group.
// - Segment contains an ordered list of groups; none are special.
// - For each end, context provides space before hard barrier
//   and an accept(item):boolean function
//   (called when an item's center crosses the end of the segment)

export enum ConveyorBeltEnd {
	HEAD,
	TAIL
}

export interface ConveyorBeltItem<ItemPayload> {
	/**
	 * Position of the item's 'front side' (towards segment head)
	 * relative to the belt segment's origin position.
	 * 
	 * Not needed for items in compacted groups.
	 */
	headPosition? : number;
	/**
	 * How much space does each instance of this item take up?
	 * (to get total span, multiply by repetitions)
	 */
	subSpan : number;
	/**
	 * How many times is this item repeated?
	 * Must be a positive (non-zero) integer.
	 */
	repetitions : number;
	/** The object itself (probably a PhysicalObject) */
	payload? : ItemPayload;
	/** ID of the payload object */
	payloadRef? : string;
}

/**
 * A bunch of items compacted together on the belt.
 * Items within a group do not record their own positions.
 */
export interface ConveyorBeltItemGroup<ItemPayload> {
	headPosition : number;
	tailPosition : number;
	items : ConveyorBeltItem<ItemPayload>[];
}

export interface ConveyorBeltSegment<ItemPayload> {
	/** The time at which all the following property values apply */
	timestamp : number;

	// TODO: Special case for segment that is a simple loop?
	/**
	 * Position of the 'belt origin' relative to the belt head.
	 * This is an arbitrary point on (or off!) the belt that items' positions are relative to
	 * so that moving items don't need to be updated each frame.
	 */
	beltOriginPosition : number;
	/*
	 * How far (meters?) the belt moves per unit time (seconds?)
	 */
	beltSpeed : number;
	/**
	 * Total length of the segment in length units (meters?)
	 * Nothing can be put on past the end.
	 */
	segmentLength : number;
	/**
	 * Ordered (by positionOnBeltSegment) list of items that are
	 * smooshed together at the head of the belt
	 */
	headBackupGroup : ConveyorBeltItemGroup<ItemPayload>;
	/**
	 * Items that are moving along the belt.
	 *
	 * If an item's position + belt origin position becomes < 0:
	 * - If it can be moved off the belt onto another segment or some other machine, it will be.
	 * - If the item cannot be moved off, it is moved to backedUpItemsAtHead
	 *
	 * Similar rules for moving items or backing them up at the tail.
	 */
	movingItems : ConveyorBeltItem<ItemPayload>[];
	/**
	 * Ordered (by positionOnBeltSegment) list of items that are
	 * smooshed together at the tail of the belt
	 */
	tailBackupGroup : ConveyorBeltItemGroup<ItemPayload>;
}

export interface ConveyorBeltUpdateContext<P> {
	spaceAtHead:number;
	spaceAtTail:number;
	removedFromHead:ConveyorBeltItem<P>[];
	removedFromTail:ConveyorBeltItem<P>[];
}

function isIdenticalItem<P>( a:ConveyorBeltItem<P>, b:ConveyorBeltItem<P> ):boolean {
	if( a.payload !== b.payload ) return false;
	if( a.payloadRef !== b.payloadRef ) return false;
	return true;
}

function maybeCombine<P>( a:ConveyorBeltItem<P>, b:ConveyorBeltItem<P> ):ConveyorBeltItem<P> {
	if( isIdenticalItem(a, b) ) {
		return {
			subSpan: a.subSpan,
			repetitions: a.repetitions + b.repetitions,
			payload: a.payload,
			payloadRef: a.payloadRef
		}
	} else return null;
}

/**
 * Adds an item to the head or tail of a group
 * and updates the group's head/tail position accordingly
 */
function appendToGroup<P>( group:ConveyorBeltItemGroup<P>, item:ConveyorBeltItem<P>, end:ConveyorBeltEnd ):void {
	const itemSpan = item.subSpan * item.repetitions;
	if( group.items.length == 0 ) {
		group.items.push(item);
	} else if( end == ConveyorBeltEnd.TAIL ) {
		const tailIdx = group.items.length-1;
		const combinedItem = maybeCombine( item, group.items[tailIdx] );
		if( combinedItem == null ) {
			group.items.push(item);
		} else {
			group.items[tailIdx] = combinedItem;
		}
	} else {
		const headIdx = 0;
		const combinedItem = maybeCombine( item, group.items[headIdx] );
		if( combinedItem == null ) {
			group.items.unshift(item);
		} else {
			group.items[headIdx] = combinedItem;
		}
	}

	if( end == ConveyorBeltEnd.TAIL ) {
		group.tailPosition += itemSpan;
	} else {
		group.headPosition += itemSpan;
	}
}

/**
 * Remove and return sub-items whose /centers/ fall within span from the specified end.
 * This is for removing items that should 'fall off' the end of the belt,
 * once it has already been determined that there is somewhere else
 * for them to go.
 *
 * The removed part of the item will be returned, or null if nothing was removed.
 * The remainder will be updated in-place (and the caller should remove it from whatever list its in if repetitions=0).
 */
function removeSpanFromItem<P>( item:ConveyorBeltItem<P>, span:number, end:ConveyorBeltEnd ):ConveyorBeltItem<P> {
	// for now do nothing
	return null;
	//throw new Error("TODO");
}

/**
 * Remove and return items whose /centers/ fall within span from the specified end.
 * This is for removing items that should 'fall off' the end of the belt,
 * once it has already been determined that there is somewhere else
 * for them to go.
 * 
 * repeated items will be split.
 * headPosition or tailPosition will be updated accordingly.
 */
function removeSpanFromGroup<P>( group:ConveyorBeltItemGroup<P>, span:number, end:ConveyorBeltEnd ):ConveyorBeltItem<P>[] {
	// For now do nothing
	return [];
	//throw new Error("TODO");
}

function fixBeltSegmentGroup<P>( seg:ConveyorBeltSegment<P>, group:ConveyorBeltItemGroup<P>, ctx:ConveyorBeltUpdateContext<P> ) {
	{
		const headDump = Math.min(0 - (group.headPosition + seg.beltOriginPosition), ctx.spaceAtHead);
		if( headDump > 0 ) {
			const removed = removeSpanFromGroup( group, headDump, ConveyorBeltEnd.HEAD );
			for( let i=0; i<removed.length; ++i ) ctx.removedFromHead.push( removed[i] );
		}
		
		const adjust = 0 - (group.headPosition + seg.beltOriginPosition);
		if( adjust > 0 ) {
			console.log("Adjusting group forward by "+adjust);
			group.headPosition += adjust;
			group.tailPosition += adjust;
		} 
	}
	
	{
		const tailDump = Math.min((group.tailPosition + seg.beltOriginPosition) - seg.segmentLength, ctx.spaceAtTail);
		if( tailDump > 0 ) {
			const removed = removeSpanFromGroup( group, tailDump, ConveyorBeltEnd.TAIL );
			for( let i=removed.length-1; i>=0; --i ) ctx.removedFromTail.push( removed[i] );
		}
		
		const adjust = seg.segmentLength - (group.tailPosition + seg.beltOriginPosition);
		if( adjust < 0 ) {
			console.log("Adjusting group backward by "+adjust);
			group.headPosition += adjust;
			group.tailPosition += adjust;
		} 
	}
}

function fixMovingItemAtHead<P>( seg:ConveyorBeltSegment<P>, ctx:ConveyorBeltUpdateContext<P> ):boolean {
	if( seg.movingItems.length == 0 ) return false;
	
	const item = seg.movingItems[0];
	
	if( seg.headBackupGroup.items.length > 0 && item.headPosition < seg.headBackupGroup.tailPosition ) {
		seg.movingItems.shift();
		appendToGroup(seg.headBackupGroup, item, ConveyorBeltEnd.HEAD);
		return true;
	}
	
	{
		const headDump = Math.min(0 - (item.headPosition + seg.beltOriginPosition), ctx.spaceAtHead);
		const removed = removeSpanFromItem( item, headDump, ConveyorBeltEnd.HEAD );
		if( removed != null ) ctx.removedFromHead.push( removed );
		
		const dangle = 0 - (item.headPosition + seg.beltOriginPosition);
		if( dangle > ctx.spaceAtHead ) {
			// We got blocked.
			// The item has become the new head backup!
			seg.movingItems.shift();
			appendToGroup(seg.headBackupGroup, item, ConveyorBeltEnd.HEAD);
			return true;
		}
	}
	
	return false;
}

function fixMovingItemAtTail<P>( seg:ConveyorBeltSegment<P>, ctx:ConveyorBeltUpdateContext<P> ):boolean {
	// This doesn't do anything yet.
	return false;
}

/**
 * Removes items that have fallen off the ends of the belt
 * and fixes positions of backed up items.
 */
function fixBeltSegment<P>( seg:ConveyorBeltSegment<P>, ctx:ConveyorBeltUpdateContext<P> ):void {
	fixBeltSegmentGroup( seg, seg.headBackupGroup, ctx );
	fixBeltSegmentGroup( seg, seg.tailBackupGroup, ctx );
	while( fixMovingItemAtHead( seg, ctx ) );
	while( fixMovingItemAtTail( seg, ctx ) );
}

export function updateBeltSegment<P>( seg:ConveyorBeltSegment<P>, toTimestamp:number, ctx:ConveyorBeltUpdateContext<P> ):void {
	const dt:number = toTimestamp - seg.timestamp;
	const movement:number = dt * seg.beltSpeed;
	seg.timestamp = toTimestamp;
	seg.beltOriginPosition += movement;
	if( movement == 0 ) {
		// Nothing to do, yay!
		return;
	}
	
	// Otherwise we need to 'fix' the belt.
	fixBeltSegment( seg, ctx );
	
	/*
	if( movement > 0 ) {
		// Try to move by /movement/.
		// If there is limited space, only the items fitting in that space get moved off the end.
		// The next item gets moved to the end.
		// Moving items may get stuck in backup.
		
		const attemptedNewTailPosition = seg.tailBackupGroup.tailPosition + seg.beltOriginPosition;
		if( attemptedNewTailPosition < seg.segmentLength ) return; // Nothing to be done!
		const attemptedDumpSpan = attemptedNewTailPosition - seg.segmentLength;
		const maxDumpSpan = Math.min(
		
		let i = seg.tailBackupGroup.items.length-1;
		while( i >= 0 ) {
			const tailItem = seg.tailBackupGroup.items[i];
			// How many of it can we take?
			const takeCount = Math.floor(ctx.spaceAtTail / tailItem.subSpan);
			if( takeCount < 1 ) break; // No more coming off this end.
			let takenItem : ConveyorBeltItem<P>;
			let remainingItem : ConveyorBeltItem<P>;
			if( takeCount < tailItem.repetitions ) {
				// Well then we have to split it up
				takenItem = {
					subSpan: tailItem.subSpan,
					repetitions: takeCount,
					payload: tailItem.payload,
					payloadRef: tailItem.payloadRef
				};
				remainingItem = {
					subSpan: tailItem.subSpan,
					repetitions: tailItem.repetitions - takeCount,
					payload: tailItem.payload,
					payloadRef: tailItem.payloadRef
				};
			} else {
				takenItem = tailItem;
				remainingItem = null;
			}
			// TODO: The remaining items shouldn't just instantly move.
			// Use item groups to help organize this better.
			// Also, items should be considered on the belt by their *center*.
			// If there is room off the end, they may start moving off the end of the belt,
			// only being completely off when their center moves off.
			// Once their leading edge is past the end we cannot hold them back;
			// they will force their way onto the next segment.
			seg.tailBackupSpan -= takeCount * tailItem.subSpan;
			if( remainingItem ) {
				seg.tailBackupItems[i] = remainingItem;
				break;
			} else {
				seg.tailBackupItems.length = i;
				--i;
			}
		}
		
		i = seg.movingItems.length-1;
		while( i >= 0 ) {
			const movingItem = seg.movingItems[i];
			const movingItemTotalSpan = movingItem.subSpan * movingItem.repetitions;
			const movingItemHeadPosition = seg.beltOriginPosition + movingItem.positionOnBeltSegment;
			const movingItemTailPosition = movingItemHeadPosition + movingItemTotalSpan;
		}
	} else {
		// movement < 0
		throw new Error("Haven't implemented backwards-moving belts, yet.");
	}
	*/
};
