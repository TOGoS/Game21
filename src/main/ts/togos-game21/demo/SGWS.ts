/* Simple grid world simulator.
 * For prototyping simulation techniques without all the baggage of
 * the regular architecture
 * (decoupled rendering, entity trees, continuous space).
 *
 * For simplicity:
 * - World is a simple rectangular (power of 2 sides) surface that wraps at the edges
 * - Each cell may contain:
 *   - Terrain type
 *   - Nutrient into
 *   - A single entity
 * 
 * Stuff to simulate:
 * - Packet switching networks (this should be easy!)
 * - Electrical distribution
 * - Fluid distribution through pipes
 * - Logistic network (mines, factories, mover bots)
 */

import EthernetSwitch, {EthernetSwitchSimulator} from '../netdev/EthernetSwitch';

enum Direction {
	EAST = 0,
	SOUTHEAST = 1,
	SOUTH = 2,
	SOUTHWEST = 3,
	WEST = 4,
	NORTHWEST = 5,
	NORTH = 6,
	NORTHEAST = 7
}

function inverseDirection(dir:Direction):Direction {
	return (dir + 4)&0x7;
}

interface Entity {
	classRef: string;
	draw(c2d:CanvasRenderingContext2D, x:number, y:number, scale:number):void;
}

interface TreeEntity {
	classRef: "http://ns.nuke24.net/Game21/SGWS/Tree",
	// TODO: different species, ages, sizes
	// trees should grow larger with age and suck nutrients from the ground
}

interface ItemClass {
	volume : number;
}

interface SurfaceColor {
	r : number;
	g : number;
	b : number;
	a : number;
	/** Cache */
	rgbaString? : string;
}

function colorRgbaString( color:SurfaceColor ) {
	if( color.rgbaString ) return color.rgbaString;
	return color.rgbaString = 'rgba('+Math.round(color.r*256)+','+Math.round(color.g*256)+','+Math.round(color.b*256)+','+color.a+')';
}

interface PipeClass {
	carriesSignals : boolean;
	carriesPower : boolean;
	carriesItems : boolean;
	signalSpeed : number;
	wallColor : SurfaceColor;
	signalColor? : SurfaceColor;
	// Where is it drawn within a cell, x and y-wise;
	offset : number;
	internalDiameter : number;
	// Wall thickness is always assumed 1/16
}

type PipeClassRef =
	"http://ns.nuke24.net/Game21/SGWS/Pipe/Signal" |
	"http://ns.nuke24.net/Game21/SGWS/Pipe/Power" |
	"http://ns.nuke24.net/Game21/SGWS/Pipe/Fluid" |
	"http://ns.nuke24.net/Game21/SGWS/Pipe/Item";

const pipeClasses:{[k:string]: PipeClass} = {
	"http://ns.nuke24.net/Game21/SGWS/Pipe/Signal": {
		carriesSignals: true,
		carriesPower: false,
		carriesItems: false,
		signalSpeed: 1,
		wallColor: {r:1/8, g:1/2, b:1/8, a:1},
		signalColor: {r:1, g:1, b:1, a:1},
		offset: -3/16,
		internalDiameter: 2/16,
	}
}

interface Pipe {
	classRef: string,
	end0Dir: Direction,
	end1Dir: Direction,
	/** Any packet travelling from end 0 to end 1 */
	signal0?: Packet,
	/** Any packet travelling from end 1 to end 0 */
	signal1?: Packet
	
}

interface NetworkDeviceEntity {
	classRef: "http://ns.nuke24.net/Game21/SGWS/NetworkDevice";
	deviceClassRef: string;
	deviceData: any;
}

type Packet = Uint8Array;

interface EntitySimulator<Entity> {
	draw( entity:Entity, ctx:CanvasRenderingContext2D, x:number, y:number, scale:number ):void;
	packetReceived( entity:Entity, originDirection:Direction, packet:Packet, ws:SGWorldSimulator ):void;
}

const entitySimulators:{[entityClassRef:string]: EntitySimulator<any>} = {
	//"http://ns.nuke24.net/Game21/SGWS/NetworkDevice": new NetworkDeviceEntity,
}

const EMPTY_STACK:Entity[] = [];

class Block implements Entity {
	classRef = "http://ns.nuke24.net/Game21/SGWS/Block";
	public draw(c2d:CanvasRenderingContext2D, x:number, y:number, scale:number):void {
		c2d.fillStyle = 'rgb(0,0,0)';
		c2d.rect(x-scale/2, y-scale/2, scale, scale);
		c2d.fillStyle = 'rgb(255,255,255)';
		c2d.fillRect(x-scale/2+1, y-scale/2+1, scale-2, scale-2);
	}
}

class SGWorldSimulator {
	protected width:number;
	protected height:number;
	protected xMask:number;
	protected yMask:number;
	protected entityStacks:Entity[][];
	
	constructor( public widthBits:number, public heightBits:number ) {
		this.width = 1 << widthBits;
		this.xMask = this.width-1;
		this.height = 1 << heightBits;
		this.yMask = this.height-1;
		
		this.entityStacks = new Array(this.width*this.height);
		for( let i=this.width*this.height-1; i>=0; --i ) this.entityStacks[i] = EMPTY_STACK;
	}
	
	public addEntity( x:number, y:number, entity:Entity ) {
		let index = x+this.width*y;
		if( this.entityStacks[index] === EMPTY_STACK ) {
			this.entityStacks[index] = [entity];
		} else {
			this.entityStacks[index].push(entity);
		}
	}
	
	public canvas : HTMLCanvasElement;
	public tick():void {
		this.drawScene();
	}
	
	public drawScene():void {
		let c2d = this.canvas.getContext('2d');
		if( c2d == null ) return;
		
		let canvWidth = this.canvas.width;
		let canvHeight = this.canvas.height;
		
		c2d.clearRect(0,0,canvWidth,canvHeight);
		
		let drawScale = 16;
		let drawCenterX = 8;
		let drawCenterY = 6;
		
		let y0 = Math.floor(drawCenterY - canvHeight/drawScale/2);
		let y1 = Math.ceil( drawCenterY + canvHeight/drawScale/2);
		let x0 = Math.floor(drawCenterX - canvWidth /drawScale/2);
		let x1 = Math.ceil( drawCenterX + canvWidth /drawScale/2);
		let xMask = this.xMask;
		let yMask = this.yMask;
		
		for( let y=y0; y<y1; ++y ) {
			for( let x=x0; x<x1; ++x ) {
				let idx = (x&xMask)+(y&yMask)*this.width;
				let stack = this.entityStacks[idx];
				for( let i=0; i<stack.length; ++i ) {
					stack[i].draw(c2d,
						canvWidth/2 + drawScale * (x-drawCenterX),
						canvHeight/2 + drawScale * (x-drawCenterY),
						drawScale
					);
				}
			}
		}
	}
}

class SGWSDemo {
	public canvas : HTMLCanvasElement;
	public sim : SGWorldSimulator = new SGWorldSimulator(8,8);
	public start() {
		this.sim.canvas = this.canvas;
		setInterval(this.sim.tick.bind(this.sim), 100);
	}
}

export function createDemo(canvas:HTMLCanvasElement) {
	const demo:SGWSDemo = new SGWSDemo();
	demo.canvas = canvas;
	demo.sim.addEntity(1, 2, new Block());
	return demo;
}
