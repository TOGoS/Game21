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
	curves : BeltSegmentCurve[];
	contentCurveNumber : number; // Which curve is stuff on?
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
}

export default class BeltDemo {
	protected beltSegments:KeyedList<BeltSegment> = {};
	
	public constructor( protected _canvas:HTMLCanvasElement ) { }
	
	public initBelts() {
		this.beltSegments = {
			[segAId]: {
				endpoints: [
					{
						angle: Math.PI*2/3
					},
					{
						angle: Math.PI*1/3
					},
					{
						angle: 0
					},
				],
				curves: [
					{
						endpoint0Number: 0,
						endpoint1Number: 2,
					}
				],
				contentCurveNumber: 0,
			}
		}
	}
	
	protected drawSegment( segmentId:SegmentID, endpointNumber:number, angle:number, x:number, y:number ):void {
		const seg = this.beltSegments[segmentId];
		if( !seg ) return;
		
		const endpoint = seg.endpoints[endpointNumber];
		if( !endpoint ) return;
	}
	
	protected drawArc( arc:Arc, ctx:CanvasRenderingContext2D, cursor:ArcCursor ):ArcCursor {
		const d = angDiff(arc.ang1, arc.ang0);
		const ccw = d < 0;
		
		// TODO: make sure drawing the right direction
		const cx = arc.cx+cursor.x; // TODO: fix
		const cy = arc.cy+cursor.y; // TODO: fix
		ctx.beginPath();
		ctx.arc( cx, cy, arc.radius, arc.ang0+cursor.angle, arc.ang1+cursor.angle, ccw );
		ctx.stroke();
		return {
			x: 0, y: 0, angle: 0 // TODO
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
		
		ctx.strokeStyle = 'darkgray';
		ctx.lineWidth = 2;
		/*
		ctx.beginPath();
		ctx.arc( x, y, 10, 0, Math.PI );
		ctx.stroke();
		*/
		
		const arc = {
			cx: 0,
			cy: 0,
			ang0: Math.random()*Math.PI*2,
			ang1: Math.random()*Math.PI*2,
			radius: 20
		};
		
		this.drawArc( arc, ctx, {
			x: x,
			y: y,
			angle: 0
		});
		
		ctx.strokeStyle = 'blue';
		const theOrthoArc = orthoArc(arc);
		if( theOrthoArc ) this.drawArc( theOrthoArc, ctx, {
			x: x,
			y: y,
			angle: 0
		});
		
		/*
		ctx.moveTo(20,20);
		ctx.bezierCurveTo(20,100, 200,100, 200,20);
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
