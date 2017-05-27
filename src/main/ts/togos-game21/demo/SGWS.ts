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
import { newType4Uuid } from 'tshash/uuids';
import { hexEncode } from 'tshash/utils';

function newUuidRef() {
	return "urn:uuid:"+hexEncode(newType4Uuid());
}

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

interface Vector2D { x:number, y:number }

function directionToVector(dir:Direction):Vector2D {
	switch( dir ) {
	case Direction.EAST     : return {x:+1, y: 0};
	case Direction.SOUTHEAST: return {x:+1, y:+1};
	case Direction.SOUTH    : return {x:+0, y:+1};
	case Direction.SOUTHWEST: return {x:-1, y:+1};
	case Direction.WEST     : return {x:-1, y: 0};
	case Direction.NORTHWEST: return {x:-1, y:-1};
	case Direction.NORTH    : return {x: 0, y:-1};
	case Direction.NORTHEAST: return {x:+1, y:-1};
	}
}

function inverseDirection(dir:Direction):Direction {
	return (dir + 4)&0x7;
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

interface Simject {
	classRef : string;
	/** If not defined, -Infinity assumed */
	lastUpdated? : number;
	
	// These used to be defined but shouldn't be any more.
	draw? : null;
	onWirelessPacket? : null;
}

interface TimePassed {
	classRef : "http://ns.nuke24.net/Game21/SGWS/Event/TimePassed",
	targetTime : number;
}
interface WirelessPacketCollided {
	classRef : "http://ns.nuke24.net/Game21/SGWS/Event/WirelessPacketCollided",
	packet : WirelessPacket,
}
type Event = TimePassed|WirelessPacketCollided; // |OtherStuff|Etc

class SimjectBehavior<S> {
	draw(simject:S, c2d:CanvasRenderingContext2D, x:number, y:number, scale:number):void { }
	onEvent(simject:S, simjectPosition:Vector2D, event:Event, sim:SGWorldSimulator ):S|null {
		switch( event.classRef ) {
		case "http://ns.nuke24.net/Game21/SGWS/Event/TimePassed":
			return this.onTimePassed(simject, simjectPosition, event.targetTime, sim);
		case "http://ns.nuke24.net/Game21/SGWS/Event/WirelessPacketCollided":
			return this.onWirelessPacket(simject, simjectPosition, event.packet, sim);
		}
		return simject;
	}
	onTimePassed(simject:S, simjectPosition:Vector2D, targetTime:number, sim:SGWorldSimulator):S|null {
		return simject;
	}
	onWirelessPacket(simject:S, simjectPosition:Vector2D, packet:WirelessPacket, sim:SGWorldSimulator):S|null {
		return simject;
	}
}

interface Entity extends Simject {
	// These properties managed by the simulator; don't change unless you are the simulator!
	// Use methods on simulator instead.
	id : string;
	position : Vector2D;
	active : boolean;
	destroyed? : boolean;
}

interface WirelessPacket extends Entity {
	classRef : "http://ns.nuke24.net/Game21/SGWS/Simject/WirelessPacket";
	velocity : Vector2D;
	data : Packet;
}

class WirelessPacketBehavior extends SimjectBehavior<WirelessPacket> {
	static createWirelessPacket(props:{id?:string, position:Vector2D, velocity:Vector2D, data?:Packet}):WirelessPacket {
		return {
			classRef: "http://ns.nuke24.net/Game21/SGWS/Simject/WirelessPacket",
			id: newUuidRef(),
			active: true,
			position: props.position,
			velocity: props.velocity,
			data: props.data || new Uint8Array(0)
		};
	}
	
	draw(p:WirelessPacket, c2d:CanvasRenderingContext2D, x:number, y:number, scale:number):void {
		c2d.fillStyle = 'rgba(255,255,192,0.75)';
		c2d.fillRect(x-scale/4, y-scale/4, scale/2, scale/2);
	}
	
	onTimePassed(simject:WirelessPacket, simjectPosition:Vector2D, targetTime:number, sim:SGWorldSimulator):WirelessPacket|null {
		simject = sim.moveEntity(simject, simject.position.x+simject.velocity.x, simject.position.y+simject.velocity.y);
		const stackThere = sim.getThingsAt(simject.position.x, simject.position.y);
		const event:WirelessPacketCollided = {
			classRef: "http://ns.nuke24.net/Game21/SGWS/Event/WirelessPacketCollided",
			packet: simject
		};
		for( let t in stackThere ) {
			let thing = stackThere[t];
			if( thing == undefined ) continue;
			const replacement = sim.simjectHandleEvent(thing, simject.position, event);
			if( replacement !== thing ) {
				if( replacement == null ) {
					delete stackThere[t];
				} else {
					stackThere[t] = replacement;
				}
			}
			if( simject.destroyed ) return null;
		}
		sim.markEntityActive(simject);
		return simject;
	}
}

interface TreeEntity {
	classRef: "http://ns.nuke24.net/Game21/SGWS/Tree",
	// TODO: different species, ages, sizes
	// trees should grow larger with age and suck nutrients from the ground
}

const EMPTY_STACK:Simject[] = [];

enum MirrorOrientation {
	TLBR, // \
	TRBL  // /
}

interface Mirror extends Simject {
	classRef : "http://ns.nuke24.net/Game21/Simject/Mirror";
	orientation : MirrorOrientation;
}

class MirrorBehavior extends SimjectBehavior<Mirror> {
	createMirror(props:{orientation?:MirrorOrientation}={}):Mirror {
		return {
			classRef: "http://ns.nuke24.net/Game21/Simject/Mirror",
			orientation: props.orientation || MirrorOrientation.TLBR,
		};
	}
	
	draw(mirror:Mirror, c2d:CanvasRenderingContext2D, x:number, y:number, scale:number):void {
		c2d.strokeStyle = 'rgba(255,255,192,0.75)';
		c2d.beginPath();
		switch( mirror.orientation ) {
		case MirrorOrientation.TLBR:
			c2d.moveTo(x-scale/2, y-scale/2);
			c2d.lineTo(x+scale/2, y+scale/2);
			break;
		default:
			c2d.moveTo(x+scale/2, y-scale/2);
			c2d.lineTo(x-scale/2, y+scale/2);
			break;
		}
		c2d.stroke();
	}
	
	onWirelessPacket(mirror:Mirror, position:Vector2D, packet:WirelessPacket, sim:SGWorldSimulator):Mirror {
		sim.alterEntity( packet, (packet:WirelessPacket) => {
			switch( mirror.orientation ) {
			case MirrorOrientation.TLBR:
				packet.velocity = {
					x: packet.velocity.y,
					y: packet.velocity.x
				}
				break;
			default:
				packet.velocity = {
					x: -packet.velocity.y,
					y: -packet.velocity.x
				}
			}
			return packet;
		});
		return mirror;
	}
}

interface Block extends Simject {
	classRef: "http://ns.nuke24.net/Game21/SGWS/Simject/Block";
}
class BlockBehavior extends SimjectBehavior<Block> {
	public draw(block:Block, c2d:CanvasRenderingContext2D, x:number, y:number, scale:number):void {
		c2d.fillStyle = 'rgb(0,0,0)';
		c2d.rect(x-scale/2, y-scale/2, scale, scale);
		c2d.fillStyle = 'rgb(255,255,255)';
		c2d.fillRect(x-scale/2+1, y-scale/2+1, scale-2, scale-2);
	}
	onWirelessPacket(block:Block, position:Vector2D, packet:WirelessPacket, sim:SGWorldSimulator):Block {
		sim.destroyEntity(packet);
		return block;
	}
}

class SGWorldSimulator {
	protected width:number;
	protected height:number;
	protected xMask:number;
	protected yMask:number;
	protected thingStacks:Simject[][];
	protected activeEntities:{[k:string]: Entity} = {};
	
	protected simjectBehaviors:{[k:string]: SimjectBehavior<any>} = {
		"http://ns.nuke24.net/Game21/SGWS/Simject/Mirror": new MirrorBehavior,
		"http://ns.nuke24.net/Game21/SGWS/Simject/Block": new BlockBehavior,
		"http://ns.nuke24.net/Game21/SGWS/Simject/WirelessPacket": new WirelessPacketBehavior,
	};
	
	constructor( public widthBits:number, public heightBits:number ) {
		this.width = 1 << widthBits;
		this.xMask = this.width-1;
		this.height = 1 << heightBits;
		this.yMask = this.height-1;
		
		this.thingStacks = new Array(this.width*this.height);
		for( let i=this.width*this.height-1; i>=0; --i ) this.thingStacks[i] = EMPTY_STACK;
	}
	
	public simjectHandleEvent( simject:Simject, position:Vector2D, event:Event ):Simject|null {
		const behavior = this.simjectBehaviors[simject.classRef];
		if( !behavior ) throw new Error("No behavior for entity class '"+simject.classRef+"'");
		return behavior.onEvent(simject, position, event, this);
	}
	
	public addEntity(entity:Entity) {
		this.addThing(entity, entity.position);
	}
	
	public addThing( thing:Simject|Entity, position:Vector2D ):void {
		let index = (position.x&this.xMask)+this.width*(position.y&this.yMask);
		if( this.thingStacks[index] === EMPTY_STACK ) {
			this.thingStacks[index] = [thing];
		} else {
			this.thingStacks[index].push(thing);
		}
		let eThing = thing as any as Entity;
		if( eThing.id ) {
			eThing.position = position;
			if( eThing.active ) this.markEntityActive(eThing);
		}
	}
	
	public removeThing( entity:Simject, position:Vector2D ):void {
		let index = (position.x&this.xMask)+this.width*(position.y&this.yMask);
		let stack = this.thingStacks[index];
		for( let i=0; i<stack.length; ++i ) {
			if( stack[i] === entity ) {
				if( stack.length == 1 ) {
					this.thingStacks[index] = EMPTY_STACK;
				} else {
					stack.splice(i,1);
				}
				return;
			}
		}
	}
	
	public alterEntity( entity:Entity, alterer:(e:Entity)=>Entity ):Entity {
		// A ha ha for now assume
		const replacement = alterer(entity);
		if( replacement !== entity ) throw new Error("hahaha alterEntity doesn't support replacing yet");
		return replacement;
	}
	
	public destroyEntity( entity:Entity ):void {
		this.removeThing(entity, entity.position);
		entity.destroyed = true;
	}
	
	public getThingsAt( x:number, y:number ):Simject[] {
		let index = (x&this.xMask)+this.width*(y&this.yMask);
		return this.thingStacks[index];
	}
	
	public canvas : HTMLCanvasElement;
	protected currentTick = 0;
	public tick():void {
		this.drawScene();
		let activeEntities = this.activeEntities;
		this.activeEntities = {};
		const event:Event = {
			classRef : "http://ns.nuke24.net/Game21/SGWS/Event/TimePassed",
			targetTime : this.currentTick+1
		}
		for( let i in activeEntities ) {
			activeEntities[i].active = false;
			this.simjectHandleEvent( activeEntities[i], activeEntities[i].position, event );
		}
		++this.currentTick;
	}
	
	public markEntityActive(entity:Entity) {
		entity.active = true;
		this.activeEntities[entity.id] = entity;
	}
	
	public moveEntity<E extends Entity>(entity:E, x:number, y:number):E {
		const oldX = Math.floor(entity.position.x), oldY = Math.floor(entity.position.y);
		const newX = x&this.xMask, newY = y&this.yMask;
		if( oldX == newX && oldY == newY ) {
			// TODO: Mod between 0..width/height
			entity.position = {x,y};
			return entity;
		}
		
		this.removeThing(entity, {x:oldX, y:oldY});
		this.addThing(entity, {x:newX, y:newY});
		// TODO: Mod between 0..width/height
		entity.position = {x,y};
		return entity;
	}
	
	public drawScene():void {
		let c2d = this.canvas.getContext('2d');
		if( c2d == null ) return;
		
		let canvWidth = this.canvas.width;
		let canvHeight = this.canvas.height;
		
		c2d.fillStyle = 'rgb(0,0,0)';
		c2d.fillRect(0,0,canvWidth,canvHeight);
		
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
				let index = (x&xMask)+(y&yMask)*this.width;
				let stack = this.thingStacks[index];
				for( let i=0; i<stack.length; ++i ) {
					const beh = this.simjectBehaviors[stack[i].classRef];
					if( beh == undefined ) {
						console.error("No behavior defined for "+stack[i].classRef+"; can't draw");
						continue;
					}
					beh.draw(stack[i], c2d,
						canvWidth /2 + drawScale * (x-drawCenterX),
						canvHeight/2 + drawScale * (y-drawCenterY),
						drawScale
					);
				}
			}
		}
	}
}

class SGWSDemo {
	public canvas : HTMLCanvasElement;
	public sim : SGWorldSimulator = new SGWorldSimulator(6,6);
	public start() {
		this.sim.canvas = this.canvas;
		setInterval(this.sim.tick.bind(this.sim), 100);
	}
}

export function createDemo(canvas:HTMLCanvasElement) {
	const demo:SGWSDemo = new SGWSDemo();
	demo.canvas = canvas;
	const block:Block = {
		classRef: "http://ns.nuke24.net/Game21/SGWS/Simject/Block",
	};
	demo.sim.addThing(block, {x:0, y:2});
	demo.sim.addThing(block, {x:1, y:2});
	demo.sim.addThing(block, {x:1, y:3});
	for( let i=0; i<6; ++i ) {
		demo.sim.addEntity(WirelessPacketBehavior.createWirelessPacket({position:{x:2, y:2-i*4}, velocity:{x:0,y:1}}));
	}
	demo.sim.addThing({
		classRef: "http://ns.nuke24.net/Game21/SGWS/Simject/Mirror"
	}, {x:2, y:4});
	demo.sim.addThing(block, {x:1, y:6});
	demo.sim.addThing(block, {x:3, y:6});
	return demo;
}
