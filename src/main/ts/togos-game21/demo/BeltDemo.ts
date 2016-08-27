import KeyedList from '../KeyedList';
import Vector3D from '../Vector3D';
import { uuidUrn, newType4Uuid } from '../../tshash/uuids';

type SegmentID = string;

// Curves defined as 'orthogonal circles'

interface BeltSegmentEndpoint {
	angle : number;
	// If linked:
	linkedSegmentId? : SegmentID;
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

function newUuidRef() { return uuidUrn(newType4Uuid()); }

const newSegmentId = newUuidRef;

const segAId = newSegmentId();
const segBId = newSegmentId();

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
	
	if( diff > -0.01 && diff < 0.01 ) return null; // Straight line!
	
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
}

export default class BeltDemo {
	protected beltSegments:KeyedList<BeltSegment> = {};
	
	public constructor( protected _canvas:HTMLCanvasElement ) { }
	
	public initBelts() {
		this.beltSegments = {
			[segAId]: {
				endpoints: [
					{
						angle: Math.PI*4/3
					},
					{
						angle: Math.PI*2/3
					},
					{
						angle: 0
					},
				],
				arcs: [
					{
						endpoint0Number: 0,
						endpoint1Number: 2,
					},
					{
						endpoint0Number: 1,
						endpoint1Number: 2,
					}
				],
				activeArcNumber: 0,
				radius: 1,
			}
		}
	}
	
	protected drawSegment( segmentId:SegmentID, inpointNumber:number, ctx:CanvasRenderingContext2D, cursor:ArcCursor ):void {
		const seg = this.beltSegments[segmentId];
		if( !seg ) return;
		
		const cx = cursor.x + seg.radius*cursor.scale*Math.cos(cursor.angle);
		const cy = cursor.y + seg.radius*cursor.scale*Math.sin(cursor.angle);
		
		ctx.lineWidth = 1;
		ctx.strokeStyle = 'darkgray';
		ctx.beginPath();
		ctx.arc(cx, cy, seg.radius*cursor.scale, 0, Math.PI*2);
		ctx.stroke();
		
		const inpoint = seg.endpoints[inpointNumber];
		if( !inpoint ) return;
		
		for( let a = 0; a < seg.arcs.length; ++a ) {
			const segArc = seg.arcs[a];
			const ep0 = seg.endpoints[segArc.endpoint0Number];
			const ep1 = seg.endpoints[segArc.endpoint1Number];
			const ang0 = cursor.angle + Math.PI*2 + ep0.angle - inpoint.angle;
			const ang1 = cursor.angle + Math.PI*2 + ep1.angle - inpoint.angle;
			const arc = {
				cx: cx,
				cy: cy,
				radius: seg.radius*cursor.scale,
				ang0: ang0,
				ang1: ang1,
			}
			ctx.lineWidth = 2;
			ctx.strokeStyle = (a == seg.activeArcNumber) ? 'darkgreen' : 'darkred';
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
				arc.cx+arc.radius*Math.sin(arc.ang0)
			);
			ctx.lineTo(
				arc.cx+arc.radius*Math.cos(arc.ang1),
				arc.cx+arc.radius*Math.sin(arc.ang1)
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
		
		this.drawSegment( segAId, 0, ctx, { x, y, angle:0, scale:10 } );
		
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
