import KeyedList from '../KeyedList';
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

interface BeltSegmentCurve {
	endpoint0Number : number;
	endpoint1Number : number;
}

interface BeltSegment {
	endpoints : BeltSegmentEndpoint[];
	arcs : BeltSegmentCurve[];
	activeArcNumber : number; // Which curve is stuff on?
	radius : number;
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

function orthoArc( from:Arc ):Arc|null {
	const diff = angDiff(from.ang1, from.ang0);
	
	if( diff > Math.PI-0.1 || diff < -Math.PI+0.1 ) return null; // [Close to] a straight line!
	
	const halfDiff = diff/2;
	const dist = from.radius / Math.cos(halfDiff);
	const dir = from.ang0 + halfDiff;
	const orthoHalfDiff = (halfDiff < 0 ? -1 : 1) * Math.PI/2 - halfDiff;
	
	const oa = {
		cx: from.cx + dist*Math.cos(dir),
		cy: from.cy + dist*Math.sin(dir),
		ang0: fixAng(dir + Math.PI + orthoHalfDiff),
		ang1: fixAng(dir + Math.PI - orthoHalfDiff),
		radius: from.radius * Math.abs(Math.sin(halfDiff) / Math.cos(halfDiff)),
	}
	console.log(from.ang0+" to "+from.ang1+" ("+diff+") -ortho-> "+oa.ang0+" to "+oa.ang1);
	return oa;
}

interface ArcCursor {
	x : number;
	y : number;
	angle : number;
	scale : number;
	distance : number;
}

function rgbaStyle(r:number, g:number, b:number, a:number):string {
	return 'rgba('+((r*255)|0)+','+((g*255)|0)+','+((b*255)|0)+','+a+')';
}

function newUuidRef() { return uuidUrn(newType4Uuid()); }

const newSegmentId = newUuidRef;

const segAId = newSegmentId();
const segBId = newSegmentId();
const segCId = newSegmentId();

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
					{ angle: Math.PI*4/3 },
					{ angle: Math.PI*2/3 },
					{ angle: 0 },
				],
				arcs: [
					{ endpoint0Number: 0, endpoint1Number: 2 },
					{ endpoint0Number: 1, endpoint1Number: 2 }
				],
				activeArcNumber: 0,
				radius: 1,
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
				radius: 4,
			},
			[segCId]: {
				endpoints: [
					{ angle: Math.PI*5/7 },
					{ angle: Math.PI*3/7 },
					{ angle: 0 },
				],
				arcs: [
					{ endpoint0Number: 0, endpoint1Number: 2 },
					{ endpoint0Number: 1, endpoint1Number: 2 }
				],
				activeArcNumber: 0,
				radius: 2,
			},
		};
		this.linkBeltSegments( segAId, 0, segCId, 0 );
		this.linkBeltSegments( segAId, 1, segCId, 1 );
		this.linkBeltSegments( segAId, 2, segBId, 0 );
		this.linkBeltSegments( segCId, 2, segBId, 1 );
	}
	
	protected drawDistance = 5;
	
	protected drawSegment( segmentId:BeltSegmentID, inpointNumber:number, ctx:CanvasRenderingContext2D, cursor:ArcCursor ):void {
		if( cursor.distance > this.drawDistance ) return;
		
		const seg = this.beltSegments[segmentId];
		if( !seg ) return;
		
		const inpoint = seg.endpoints[inpointNumber];
		if( !inpoint ) return;
		
		const cx = cursor.x + seg.radius*cursor.scale*Math.cos(cursor.angle);
		const cy = cursor.y + seg.radius*cursor.scale*Math.sin(cursor.angle);

		const angAdj = cursor.angle - inpoint.angle + Math.PI;
		
		if( cursor.distance+1 < this.drawDistance ) for( let e = 0; e < seg.endpoints.length; ++e ) {
			if( e == inpointNumber && cursor.distance > 0 ) continue;
			
			const ep = seg.endpoints[e];
			if( ep.linkedSegmentId == null || ep.linkedEndpointNumber == null ) continue;
			
			const ang = ep.angle + angAdj;
			this.drawSegment( ep.linkedSegmentId, ep.linkedEndpointNumber, ctx, {
				x: cx + seg.radius*cursor.scale*Math.cos(ang),
				y: cy + seg.radius*cursor.scale*Math.sin(ang),
				angle: ang,
				scale: cursor.scale,
				distance: cursor.distance + 1,
			});
		}
		
		const opac = Math.pow((this.drawDistance - cursor.distance)/this.drawDistance, 1.5);
		ctx.lineWidth = 1;
		ctx.strokeStyle = rgbaStyle(0.5,0.5,0.5,opac);
		ctx.beginPath();
		ctx.arc(cx, cy, seg.radius*cursor.scale, 0, Math.PI*2);
		ctx.stroke();
		
		for( let a = 0; a < seg.arcs.length; ++a ) {
			const segArc = seg.arcs[a];
			const ep0 = seg.endpoints[segArc.endpoint0Number];
			const ep1 = seg.endpoints[segArc.endpoint1Number];
			const ang0 = ep0.angle + angAdj;
			const ang1 = ep1.angle + angAdj;
			const arc = {
				cx: cx,
				cy: cy,
				radius: seg.radius*cursor.scale,
				ang0: ang0,
				ang1: ang1,
			}
			ctx.lineWidth = 2;
			ctx.strokeStyle = (a == seg.activeArcNumber) ? rgbaStyle(0.2,0.5,0.2,opac) : rgbaStyle(0.5,0.2,0.2,opac);
			this.drawOrthoArc( arc, ctx );
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
	
	protected drawOrthoArc( arc:Arc, ctx:CanvasRenderingContext2D ):void {
		const orth = orthoArc(arc);
		if( orth ) {
			this.drawArc( orth, ctx );
		} else {
			ctx.beginPath();
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
	
	public drawScene():void {
		const ctx = this._canvas.getContext('2d');
		if( !ctx ) return;
		
		const canvasWidth = this._canvas.width;
		const canvasHeight = this._canvas.height;
		
		ctx.clearRect(0,0,canvasWidth,canvasHeight);
		
		let x = canvasWidth/2;
		let y = canvasHeight/2;
		
		this.drawSegment( segAId, 0, ctx, { x, y, angle:0, scale:5, distance:0 } );
		
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
	
	public start() {
		let animFrame = () => {};
		animFrame = () => {
			this.drawScene();
			
			//requestAnimationFrame(animFrame);
		};
		requestAnimationFrame(animFrame);
	}
}

export function buildUi( canv:HTMLCanvasElement ):BeltDemo {
	const dem = new BeltDemo(canv);
	dem.initBelts();
	return dem;
}
