import KeyedList, {keyedListIsEmpty} from '../KeyedList';
import LightColor from '../LightColor';
import Vector3D from '../Vector3D';
import { uuidUrn, newType4Uuid } from '../../tshash/uuids';

type BeltSegmentID = string;

// Curves defined as 'orthogonal circles'

interface BeltSegmentEndpoint {
	angle : number;
	// If linked:
	linkedSegmentId? : BeltSegmentID;
	linkedEndpointNumber? : number;
}

interface BeltSegmentArc {
	endpoint0Number : number;
	endpoint1Number : number;
}

interface BeltItem {
	x : number;
	orientation : number;
	/** How much on each side of x does the item take up? */
	radius : number;
	color : LightColor;
}

const AUTO_ACTIVATING = 0x01;
const AUTO_SWITCHING  = 0x02;
const DESIRES_SWITCH  = 0x04;

interface BeltSegment {
	endpoints : BeltSegmentEndpoint[];
	speed : number; // meters per second!
	arcs : BeltSegmentArc[];
	activeArcNumber : number; // Which curve is stuff on?
	radius : number;
	flags : number;
	items : KeyedList<BeltItem>;
}

interface Line {
	x0 : number;
	y0 : number;
	x1 : number;
	y1 : number;
}

interface Arc {
	cx : number;
	cy : number;
	ang0 : number;
	ang1 : number;
	radius : number;
}

function angDiff( ang1:number, ang0:number ):number {
	const diff = ang1 - ang0;
	if( diff >  Math.PI ) return diff - Math.PI*2;
	if( diff < -Math.PI ) return diff + Math.PI*2;
	return diff;
}

function fixAng( ang:number ):number {
	const bro = ang/(Math.PI*2);
	return Math.PI*2*(bro - Math.floor(bro));
}

function orthoArcLength( from:Arc ):number {
	const diff = angDiff(from.ang1, from.ang0);
	const halfDiff = diff/2;
	const orthoHalfDiff = (halfDiff < 0 ? -1 : 1) * Math.PI/2 - halfDiff;
	return Math.abs(orthoHalfDiff*2 * from.radius * Math.abs(Math.sin(halfDiff) / Math.cos(halfDiff)));
}
function orthoArc( from:Arc, startRat:number=0, endRat:number=1 ):Arc|null {
	const diff = angDiff(from.ang1, from.ang0);
	
	if( diff > Math.PI-0.1 || diff < -Math.PI+0.1 ) return null; // [Close to] a straight line!
	
	const halfDiff = diff/2;
	const dist = from.radius / Math.cos(halfDiff);
	const dir = from.ang0 + halfDiff;
	const orthoHalfDiff = (halfDiff < 0 ? -1 : 1) * Math.PI/2 - halfDiff;
	
	const orthoAng0 = dir + Math.PI + orthoHalfDiff;
	//const orthoAng1 = dir + Math.PI - orthoHalfDiff;
	const orthoDiff = orthoHalfDiff * 2;//angDiff(toAng, fromAng);
	
	const oa = {
		cx: from.cx + dist*Math.cos(dir),
		cy: from.cy + dist*Math.sin(dir),
		ang0: orthoAng0 - startRat*orthoDiff,
		ang1: orthoAng0 - endRat*orthoDiff,
		radius: from.radius * Math.abs(Math.sin(halfDiff) / Math.cos(halfDiff)),
	}
	return oa;
}

interface ArcCursor {
	x : number;
	y : number;
	angle : number;
	scale : number;
	distance : number;
	targetDistance : number;
}

function rgbaStyle(r:number, g:number, b:number, a:number, brightness:number=1):string {
	r *= brightness;
	g *= brightness;
	b *= brightness;
	return 'rgba('+((r*255)|0)+','+((g*255)|0)+','+((b*255)|0)+','+a+')';
}

function clamp( r:number, min:number=0, max:number=1 ) {
	return r < min ? min : r > max ? max : r;
}

function newUuidRef() { return uuidUrn(newType4Uuid()); }

const newSegmentId = newUuidRef;

const segAId = "segA";//newSegmentId();
const segBId = "segB";//newSegmentId();
const segCId = "segC";//newSegmentId();
const segDId = "segD";
const segEId = "segE";
const segFId = "segF";
const cameraItemUuid = "cam";//newUuidRef();
const yellowItemUuid = "yel";
const orangeItemUuid = "ornj";

declare function Symbol(x:string):symbol;

const lengthCacheSymbol = Symbol("arc length");

function segmentArcLength( arc:BeltSegmentArc, segment:BeltSegment ) {
	if( (<any>arc)[lengthCacheSymbol] ) return (<any>arc)[lengthCacheSymbol];
	
	const ep0 = segment.endpoints[arc.endpoint0Number];
	const ep1 = segment.endpoints[arc.endpoint1Number];
	
	const length = orthoArcLength({
		cx: 0,
		cy: 0,
		radius: segment.radius,
		ang0: ep0.angle,
		ang1: ep1.angle,
	});
	
	return (<any>arc)[lengthCacheSymbol] = length;
}

function segmentMutated( seg:BeltSegment ) {
	for( let a = 0; a < seg.arcs.length; ++a ) {
		delete (<any>seg.arcs[a])[lengthCacheSymbol];
	}
};

function mutateSegment( seg:BeltSegment ) {
	if( !keyedListIsEmpty(seg.items) ) return;
	
	{
		const r = Math.random();
		if( r < 0.1 ) {
			if( seg.radius < 4 )	seg.radius += 1/64;
		} else if( r < 0.2 ) {
			if( seg.radius > 1 ) seg.radius -= 1/64;
		}
	}
	
	for( let e = 0; e < seg.endpoints.length; ++e ) {
		const r = Math.random();
		if( r < 0.1 ) {
			seg.endpoints[e].angle = fixAng(seg.endpoints[e].angle + 1/128);
		} else if( r < 0.2 ) {
			seg.endpoints[e].angle = fixAng(seg.endpoints[e].angle - 1/128);
		}
	}
	
	segmentMutated(seg);
}

export default class BeltDemo {
	protected beltSegments:KeyedList<BeltSegment> = {};
	
	public constructor( protected _canvas:HTMLCanvasElement ) { }
	
	public unlinkBeltSegment( segId:BeltSegmentID, endpointNumber:number ) {
		const seg = this.beltSegments[segId];
		if( !seg ) return;
		const endpoint = seg.endpoints[endpointNumber];
		if( !endpoint ) return;
		
		fixLinkedSegment: if( endpoint.linkedSegmentId != null && endpoint.linkedEndpointNumber != null ) {
			const linkedSeg = this.beltSegments[endpoint.linkedSegmentId];
			if( !linkedSeg ) break fixLinkedSegment;
			const linkedEndpoint = linkedSeg.endpoints[endpoint.linkedEndpointNumber];
			if( !linkedEndpoint ) break fixLinkedSegment;
			delete linkedEndpoint.linkedSegmentId;
			delete linkedEndpoint.linkedEndpointNumber;
		}
		
		delete endpoint.linkedSegmentId;
		delete endpoint.linkedEndpointNumber;
	}
	
	public update(t:number) {
		for( let s in this.beltSegments ) {
			const seg = this.beltSegments[s];

			if( (seg.flags & DESIRES_SWITCH) && this.segmentIsEmpty(seg) ) {
				seg.activeArcNumber += 1;
				seg.activeArcNumber %= seg.arcs.length;
				seg.flags &= ~DESIRES_SWITCH;
			}
			mutateSegment(seg);
			
			if( keyedListIsEmpty(seg.items) ) continue;
			
			const a = seg.activeArcNumber;
			const arc = seg.arcs[a];
			const ep1:BeltSegmentEndpoint|undefined = arc.endpoint1Number == null ? undefined : seg.endpoints[arc.endpoint1Number];
			let linkedSegmentId:BeltSegmentID|undefined;
			let linkedSegment:BeltSegment|undefined;
			let linkedArcNumber:number = 0;
			let linkedArc:BeltSegmentArc|undefined;
			if( ep1 && ep1.linkedSegmentId ) {
				const possiblyLinkedSegment = this.beltSegments[ep1.linkedSegmentId];
				if( possiblyLinkedSegment ) {
					// Try to pick one without auto-activating
					for( let la = 0; la < possiblyLinkedSegment.arcs.length; ++la ) {
						const possiblyLinkedArc = possiblyLinkedSegment.arcs[la];
						if(
							possiblyLinkedArc.endpoint0Number == ep1.linkedEndpointNumber &&
							possiblyLinkedSegment.activeArcNumber == la
						) {
							linkedSegmentId = ep1.linkedSegmentId;
							linkedSegment = possiblyLinkedSegment;
							linkedArcNumber = la;
							linkedArc = possiblyLinkedArc;
						}
					}
					// If not found, try auto-activating one
					if( !linkedArc ) for( let la = 0; la < possiblyLinkedSegment.arcs.length; ++la ) {
						const possiblyLinkedArc = possiblyLinkedSegment.arcs[la];
						if(
							possiblyLinkedArc.endpoint0Number == ep1.linkedEndpointNumber &&
							(possiblyLinkedSegment.flags & AUTO_ACTIVATING) &&
							keyedListIsEmpty(possiblyLinkedSegment.items)
						) {
							linkedSegmentId = ep1.linkedSegmentId;
							linkedSegment = possiblyLinkedSegment;
							linkedArcNumber = la;
							linkedArc = possiblyLinkedArc;
						}
					}
				}
			}

			let space:number = 0;
			if( linkedSegment && linkedArc ) {
				space = segmentArcLength(linkedArc, linkedSegment);
				for( let li in linkedSegment.items ) {
					const linkedItem = linkedSegment.items[li];
					space = Math.min(space, linkedItem.x - linkedItem.radius);
				}
			}
			
			const arcLength = segmentArcLength(arc, seg);
			for( let i in seg.items ) {
				const item = seg.items[i];
				item.x += t * seg.speed;
				if( item.x + item.radius > arcLength + space ) {
					item.x = arcLength + space - item.radius;
				}
				if( item.x >= arcLength && linkedSegment ) {
					delete seg.items[i];
					item.x -= arcLength;
					linkedSegment.items[i] = item;
					linkedSegment.activeArcNumber = linkedArcNumber;
					seg.flags |= DESIRES_SWITCH;
				}
			}
		}
	}
	
	public linkBeltSegments( segAId:BeltSegmentID, endpointANumber:number, segBId:BeltSegmentID, endpointBNumber:number ) {
		const segA = this.beltSegments[segAId];
		const segB = this.beltSegments[segBId];
		if( !segA ) { console.warn("No such segment to link: "+segAId); return; }
		if( !segB ) { console.warn("No such segment to link: "+segBId); return; }
		const endpointA = segA.endpoints[endpointANumber];
		const endpointB = segB.endpoints[endpointBNumber];
		if( !endpointA ) { console.warn("No such endpoint "+endpointANumber+" on segment "+segAId); return; }
		if( !endpointB ) { console.warn("No such endpoint "+endpointBNumber+" on segment "+segBId); return; }
		this.unlinkBeltSegment(segAId, endpointANumber);
		this.unlinkBeltSegment(segBId, endpointBNumber);
		
		endpointA.linkedSegmentId = segBId;
		endpointA.linkedEndpointNumber = endpointBNumber;
		endpointB.linkedSegmentId = segAId;
		endpointB.linkedEndpointNumber = endpointANumber;
	}

	public initBelts() {
		this.beltSegments = {
			[segAId]: {
				endpoints: [
					{ angle: 0 },
					{ angle: 2 },
					{ angle: -2 },
				],
				arcs: [
					{ endpoint0Number: 0, endpoint1Number: 1 },
					{ endpoint0Number: 0, endpoint1Number: 2 }
				],
				activeArcNumber: 0,
				speed: 1,
				radius: 1,
				flags: AUTO_ACTIVATING | AUTO_SWITCHING,
				items: {},
			},
			[segBId]: {
				endpoints: [
					{ angle: 0 },
					{ angle: 2 },
				],
				arcs: [
					{ endpoint0Number: 0, endpoint1Number: 1 }
				],
				activeArcNumber: 0,
				speed: 1,
				radius: 4,
				flags: AUTO_ACTIVATING | AUTO_SWITCHING,
				items: {
					[cameraItemUuid]: {
						x: 1.0,
						orientation: 0,
						radius: 0.1,
						color: new LightColor(1,1,1),
					}
				},
			},
			[segCId]: {
				endpoints: [
					{ angle: 0 },
					{ angle: 1 },
					{ angle: -1 },
				],
				arcs: [
					{ endpoint0Number: 0, endpoint1Number: 1 },
					{ endpoint0Number: 0, endpoint1Number: 2 }
				],
				activeArcNumber: 1,
				speed: 1,
				radius: 1,
				flags: AUTO_ACTIVATING | AUTO_SWITCHING,
				items: {
					[orangeItemUuid]: {
						x: 0.0,
						orientation: 0,
						radius: 1.0,
						color: new LightColor(1,0.6,0),
					},
				},
			},
			[segDId]: {
				endpoints: [
					{ angle: Math.PI*5/7 },
					{ angle: Math.PI*3/7 },
					{ angle: 0 },
				],
				arcs: [
					{ endpoint0Number: 0, endpoint1Number: 2 },
					{ endpoint0Number: 1, endpoint1Number: 2 }
				],
				activeArcNumber: 1,
				speed: 1,
				radius: 2,
				flags: AUTO_ACTIVATING | AUTO_SWITCHING,
				items: {
					[yellowItemUuid]: {
						x: 1.0,
						orientation: 0,
						radius: 0.2,
						color: new LightColor(1,1,0),
					},
				},
			},
			[segEId]: {
				endpoints: [
					{ angle: Math.PI*5/7 },
					{ angle: Math.PI*3/7 },
					{ angle: 0 },
				],
				arcs: [
					{ endpoint0Number: 0, endpoint1Number: 2 },
					{ endpoint0Number: 1, endpoint1Number: 2 }
				],
				activeArcNumber: 1,
				speed: 1,
				radius: 2,
				flags: AUTO_ACTIVATING | AUTO_SWITCHING,
				items: {},
			},
			[segFId]: {
				endpoints: [
					{ angle: Math.PI*6/7 },
					{ angle: -Math.PI*3/7 },
				],
				arcs: [
					{ endpoint0Number: 0, endpoint1Number: 1 },
				],
				activeArcNumber: 1,
				speed: 1,
				radius: 4,
				flags: AUTO_ACTIVATING | AUTO_SWITCHING,
				items: {},
			},
		};
		this.linkBeltSegments( segAId, 2, segBId, 0 );
		this.linkBeltSegments( segAId, 1, segDId, 0 );
		this.linkBeltSegments( segBId, 1, segCId, 0 );
		this.linkBeltSegments( segCId, 1, segDId, 1 );
		this.linkBeltSegments( segCId, 2, segEId, 1 );
		this.linkBeltSegments( segDId, 2, segFId, 0 );
		this.linkBeltSegments( segFId, 1, segEId, 0 );
		this.linkBeltSegments( segEId, 2, segAId, 0 );
	}
	
	protected drawDistance = 9;
	
	public alterDrawDistance(amt:number) {
		this.drawDistance = clamp(this.drawDistance+amt, 1, 12);
	}
	
	protected segmentIsEmpty( seg:BeltSegment ):boolean {
		let isEmpty = true;
		this.eachSegmentItem(seg, (item,x) => {
			isEmpty = false;
			return false;
		});
		return isEmpty;
	}
	
	/**
	 * Iterates over all items on a segment, including those belonging to neighboring segments.
	 * If the callback returns false, this will quit early.
	 */
	protected eachSegmentItem( seg:BeltSegment, callback:(item:BeltItem, x:number)=>void|boolean ):void {
		for( let i in seg.items ) {
			if( callback( seg.items[i], seg.items[i].x ) === false ) return;
		}
		const activeArc = seg.arcs[seg.activeArcNumber];
		prevSegItems: {
			const ep0 = seg.endpoints[activeArc.endpoint0Number];
			if( !ep0 || !ep0.linkedSegmentId ) break prevSegItems;
			const prevSeg = this.beltSegments[ep0.linkedSegmentId];
			if( !prevSeg ) break prevSegItems;
			if( keyedListIsEmpty(prevSeg.items) ) break prevSegItems;
			const prevArc = prevSeg.arcs[prevSeg.activeArcNumber];
			if( prevArc.endpoint1Number != ep0.linkedEndpointNumber ) break prevSegItems;
			const prevSegLength = segmentArcLength(prevArc, prevSeg);
			for( let i in prevSeg.items ) {
				const item = prevSeg.items[i];
				if( item.x + item.radius > prevSegLength ) {
					if( callback( item, item.x - prevSegLength ) === false ) return;
				}
			}
		}
		nextSegItems: {
			const ep1 = seg.endpoints[activeArc.endpoint1Number];
			if( !ep1 || !ep1.linkedSegmentId ) break nextSegItems;
			const nextSeg = this.beltSegments[ep1.linkedSegmentId];
			if( !nextSeg ) break nextSegItems;
			const nextArc = nextSeg.arcs[nextSeg.activeArcNumber];
			if( !nextArc ) break nextSegItems;
			if( nextArc.endpoint0Number != ep1.linkedEndpointNumber ) break nextSegItems;
			const arcLength = segmentArcLength(activeArc, seg);
			for( let i in nextSeg.items ) {
				const item = nextSeg.items[i];
				if( item.x - item.radius < 0 ) {
					if( callback( item, item.x + arcLength ) === false ) return;
				}
			}
		}
	}
	
	protected drawSegment( segmentId:BeltSegmentID, inpointNumber:number|undefined, ctx:CanvasRenderingContext2D, cursor:ArcCursor ):void {
		if( cursor.distance > this.drawDistance ) return;
		
		const seg = this.beltSegments[segmentId];
		if( !seg ) return;
		
		const inpoint = (inpointNumber != null) ? seg.endpoints[inpointNumber] : undefined;
		
		const cx = inpoint ? cursor.x + seg.radius*Math.cos(cursor.angle) : cursor.x;
		const cy = inpoint ? cursor.y + seg.radius*Math.sin(cursor.angle) : cursor.y;

		const angAdj = cursor.angle - (inpoint ? inpoint.angle - Math.PI : 0);
		
		if( cursor.distance+1 < this.drawDistance ) for( let e = 0; e < seg.endpoints.length; ++e ) {
			if( e == inpointNumber && cursor.distance > 0 ) continue;
			
			const ep = seg.endpoints[e];
			if( ep.linkedSegmentId == null || ep.linkedEndpointNumber == null ) continue;
			
			const ang = ep.angle + angAdj;
			this.drawSegment( ep.linkedSegmentId, ep.linkedEndpointNumber, ctx, {
				x: cx + seg.radius*Math.cos(ang),
				y: cy + seg.radius*Math.sin(ang),
				angle: ang,
				scale: cursor.scale,
				distance: cursor.distance + 1,
				targetDistance: cursor.targetDistance,
			});
		}
		
		if( cursor.distance != cursor.targetDistance ) return;
		
		const opac = Math.pow((this.drawDistance - cursor.distance)/this.drawDistance, 1.5);
		ctx.lineWidth = 0.1;
		ctx.strokeStyle = rgbaStyle(0.5,0.5,0.5,1,opac/2);
		ctx.beginPath();
		ctx.arc(cx, cy, seg.radius, 0, Math.PI*2);
		ctx.stroke();
		
		// Modes: 0 = inactive borders, 1 = active borders, 2 = slot, 3 = items
		for( let mode = 0; mode < 4; ++mode ) {
			for( let a = 0; a < seg.arcs.length; ++a ) {
				if( a == seg.activeArcNumber && mode == 0 ) continue;
				if( a != seg.activeArcNumber && (mode == 1 || mode == 3) ) continue;
				const segArc = seg.arcs[a];
				const ep0 = seg.endpoints[segArc.endpoint0Number];
				const ep1 = seg.endpoints[segArc.endpoint1Number];
				const ang0 = ep0.angle + angAdj;
				const ang1 = ep1.angle + angAdj;
				const arc = {
					cx: cx,
					cy: cy,
					radius: seg.radius,
					ang0: ang0,
					ang1: ang1,
				}
				switch( mode ) {
				case 0: case 1:
					ctx.lineWidth = 0.4;
					ctx.lineCap = 'butt';
					ctx.strokeStyle = (a == seg.activeArcNumber) ? rgbaStyle(0.2,0.5,0.2,1,opac) : rgbaStyle(0.5,0.2,0.2,1,opac);
					this.drawOrthoArc( arc, ctx );
					break;
				case 2:
					ctx.lineWidth = 0.2;
					ctx.lineCap = 'butt';
					ctx.strokeStyle = 'black';
					this.drawOrthoArc( arc, ctx );
					break;
				case 3:
					const arcLength = segmentArcLength(segArc, seg);
					
					this.eachSegmentItem( seg, (item, x) => {
						ctx.lineCap = 'butt';
						ctx.lineWidth = 0.2;
						const col = item.color;
						ctx.strokeStyle = rgbaStyle(col.r, col.g, col.b, 1, opac);
						
						const itemStartRat = clamp( (x-item.radius)/arcLength );
						const itemEndRat   = clamp( (x+item.radius)/arcLength );
						
						this.drawOrthoArc( arc, ctx, itemStartRat, itemEndRat );
					});
					break;
				}
			}
		}
	}
	
	protected drawArc( arc:Arc, ctx:CanvasRenderingContext2D ):void {
		const d = angDiff(arc.ang1, arc.ang0);
		const ccw = d < 0;
		
		// TODO: make sure drawing the right direction
		ctx.beginPath();
		ctx.arc( arc.cx, arc.cy, arc.radius, arc.ang0, arc.ang1, ccw );
		ctx.stroke();
	}
	
	protected drawOrthoArc( arc:Arc, ctx:CanvasRenderingContext2D, startRat:number=0, endRat:number=1 ):void {
		const orth = orthoArc(arc, startRat, endRat);
		if( orth ) {
			this.drawArc( orth, ctx );
		} else {
			ctx.beginPath();
			// TODO: mind start, endrat
			ctx.moveTo(
				arc.cx+arc.radius*Math.cos(arc.ang0),
				arc.cy+arc.radius*Math.sin(arc.ang0)
			);
			ctx.lineTo(
				arc.cx+arc.radius*Math.cos(arc.ang1),
				arc.cy+arc.radius*Math.sin(arc.ang1)
			);
			ctx.stroke();
		}
	}
	
	protected pickRandomSegment():BeltSegmentID {
		while( true ) {
			let thereAreAnySegments = false;
			for( let s in this.beltSegments ) {
				if( Math.random() < 0.1 ) return s;
				thereAreAnySegments = true;
			}
			if( !thereAreAnySegments ) throw new Error("No segments left!")
		}
	}
	
	protected cleanUpLooseEnds():void {
		for( let s in this.beltSegments ) {
			const seg = this.beltSegments[s];
			for( let a = 0; a < seg.arcs.length; ++a ) {
				const ep1 = seg.endpoints[seg.arcs[a].endpoint1Number];
				// todo something
			}
		}
	}
	
	// These don't work very well:
	public randomlyDeleteLink():void {
		doSomething: for( let attempts=0; attempts < 32; ++attempts ) {
			for( let s in this.beltSegments ) {
				if( Math.random() < 0.9 ) continue;
				const seg = this.beltSegments[s];
				if( seg.arcs.length > 1 ) {
					const deleteAt = Math.floor(Math.random()*seg.arcs.length);
					seg.arcs = seg.arcs.splice(deleteAt, 1);
					seg.activeArcNumber %= seg.arcs.length;
					break doSomething;
				}
			}
		}
		this.cleanUpLooseEnds();
	}
	public randomlyInsertLink():void {
		const fromId = this.pickRandomSegment();
		const from = this.beltSegments[fromId];
		const toId = this.pickRandomSegment();
		from.endpoints.push( {
			angle: Math.random()*Math.PI*2,
		} );
		const newEndpointNumber = from.endpoints.length-1;
		from.arcs.push( {
			endpoint0Number: 0,
			endpoint1Number: newEndpointNumber,
		} );
		this.linkBeltSegments(fromId, newEndpointNumber, toId, 0);
	}
	
	protected frameNumber:number = 0;
	
	public drawScene():void {
		const ctx = this._canvas.getContext('2d');
		if( !ctx ) return;
		
		const canvasWidth = this._canvas.width;
		const canvasHeight = this._canvas.height;
		
		ctx.clearRect(0,0,canvasWidth,canvasHeight);
		
		let x = canvasWidth/2;
		let y = canvasHeight/2;
		
		ctx.save();
		ctx.translate(x, y);
		ctx.scale(10, 10);
		for( let targetDistance = this.drawDistance-1; targetDistance >= 0; --targetDistance ) {
			this.drawSegment( segAId, 0, ctx, { x:0, y:0, angle:this.frameNumber/1000, scale:5, distance:0, targetDistance } );
		}
		ctx.restore();
		
		/*
		ctx.strokeStyle = 'darkgray';
		ctx.lineWidth = 2;
		
		const arc = {
			cx: x,
			cy: y,
			ang0: Math.random()*Math.PI*2,
			ang1: Math.random()*Math.PI*2,
			radius: 20
		};
		
		this.drawArc( arc, ctx );
		
		ctx.strokeStyle = 'blue';
		const theOrthoArc = orthoArc(arc);
		if( theOrthoArc ) this.drawArc( theOrthoArc, ctx );
		*/
	};
	
	public fpsCounterElement : HTMLElement;
	
	public start() {
		let fps = 0;
		
		let animFrame = () => {};
		animFrame = () => {
			this.update(0.1);			
			this.drawScene();
			++fps;
			++this.frameNumber;
			requestAnimationFrame(animFrame);
		};
		requestAnimationFrame(animFrame);
		
		if( this.fpsCounterElement ) setInterval( () => {
			this.fpsCounterElement.firstChild.nodeValue = ""+fps;
			fps = 0;
		}, 1000 );
	}
}

export function buildUi( canv:HTMLCanvasElement ):BeltDemo {
	const dem = new BeltDemo(canv);
	dem.initBelts();
	return dem;
}
