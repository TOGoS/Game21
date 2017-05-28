import SimplexNoise from '../../SimplexNoise';

interface Vector2D { x : number; y : number; }

type TrackSegmentID = number;

interface TrackSegment {
	endpoint0 : Vector2D;
	endpoint1 : Vector2D;
	length : number;
	previousSegmentId : number;
	nextSegmentId : number;
}

interface TrackPosition {
	trackSegmentId : TrackSegmentID;
	distanceAlongSement : number;
}

interface TrainCar {
	mass : number;
	drivingPower : number; // They can self-propel, I guess!
	maxDrivingPower : number;
	brakingForce : number; // Force that is only applied to stop motion along the track
	distanceToNextCar : number;
}

interface TrainStats {
	speed : number;
	drivePower : number;
	driveForce : number;
	totalEnergy : number;
	potentialEnergy : number;
	kineticEnergy : number;
}

interface Train {
	cars : TrainCar[];
	/** Total kinetic + potential energy of the train */
	totalEnergy : number;
	car0TrackPosition : TrackPosition;
	/** Speed forward along track */
	speed : number;
	
	stats? : TrainStats;
}

interface World {
	trackSegments : TrackSegment[];
	trains : Train[];
}

interface FixedTrackPosition extends TrackPosition {
	clamped? : boolean; // True if end of track reached
}

function trackPositionToWorldPosition( tp:TrackPosition, world:World ):Vector2D {
	let segment = world.trackSegments[tp.trackSegmentId];
	let segmentDx = segment.endpoint1.x - segment.endpoint0.x;
	let segmentDy = segment.endpoint1.y - segment.endpoint0.y;
	return  {
		x: segment.endpoint0.x + segmentDx * (tp.distanceAlongSement / segment.length),
		y: segment.endpoint0.y + segmentDy * (tp.distanceAlongSement / segment.length), 
	};
}

function fixTrackPosition( tp:TrackPosition, world:World ):FixedTrackPosition {
	let segment = world.trackSegments[tp.trackSegmentId];
	while( tp.distanceAlongSement < 0 ) {
		let prevSegmentId = segment.previousSegmentId;
		segment = world.trackSegments[prevSegmentId];
		tp = {
			 trackSegmentId: prevSegmentId,
			 distanceAlongSement: tp.distanceAlongSement + segment.length
		}
	}
	while( tp.distanceAlongSement > segment.length ) {
		let nextSegmentId = segment.nextSegmentId;
		tp = {
			trackSegmentId: nextSegmentId,
			distanceAlongSement: tp.distanceAlongSement - segment.length
		}
		segment = world.trackSegments[nextSegmentId];
	}
	return tp;
}

function addTrackPosition( tp:TrackPosition, dist:number, world:World ):FixedTrackPosition {
	return fixTrackPosition({
		trackSegmentId: tp.trackSegmentId,
		distanceAlongSement: tp.distanceAlongSement + dist
	}, world);
}

const G = 9.8;

/** Return the amount of forward force on the train */
function figureTrainForceG( train:Train, world:World ):number {
	let forwardForce = 0;
	let carTrackPosition:TrackPosition = train.car0TrackPosition;
	for( let c in train.cars ) {
		const car = train.cars[c];
		
		let segment = world.trackSegments[carTrackPosition.trackSegmentId];
		// fAlong/fG = distY/distAlong
		// fAlong = fG * distY / distAlong
		// Remember that +Y is down!
		const fG = G * car.mass;
		forwardForce += fG * (segment.endpoint1.y - segment.endpoint0.y) / segment.length;  
		
		carTrackPosition = addTrackPosition(carTrackPosition, -car.distanceToNextCar, world);
	}
	return forwardForce;
}

function figureTrainMass( train:Train ):number {
	let mass = 0;
	for( let c in train.cars ) {
		let car = train.cars[c];
		mass += car.mass;
	}
	return mass;
}

function figureTrainPotentialEnergy( train:Train, carTrackPosition:TrackPosition, world:World ):number {
	let pe = 0;
	for( let c in train.cars ) {
		let car = train.cars[c];
		let carPos = trackPositionToWorldPosition(carTrackPosition, world);
		pe -= G * car.mass * carPos.y; // Minus because -y is higher PE
		carTrackPosition = addTrackPosition(carTrackPosition, -car.distanceToNextCar, world); 
	}
	return pe;
}

function figureTrainDrivePower( train:Train, world:World ):number {
	let p = 0;
	for( let c in train.cars ) {
		let car = train.cars[c];
		p += car.drivingPower;
	}
	return p;
}

function figureTrainTotalEnergy( train:Train, world:World ):number {
	let mass = figureTrainMass(train);
	let ke = mass * train.speed*train.speed / 2;
	return ke + figureTrainPotentialEnergy(train, train.car0TrackPosition, world);
}

function signOf(n:number):number {
	return n < 0 ? -1 : n > 0 ? 1 : 0;
}
function clamp(min:number, v:number, max:number):number {
	return v < min ? min : v > max ? max : v;
}

function moveTrain( train:Train, interval:number, world:World ):Train {
	let forwardForceG = figureTrainForceG(train, world);
	let drivePower = figureTrainDrivePower(train, world);
	// p = F * d / time
	// d / time = speed
	// p = F * speed
	// F = p / speed
	const maxDriveForce = 10000;
	let driveForce:number;
	if( train.speed == 0 ) {
		driveForce = maxDriveForce * signOf(drivePower)
	} else {
		driveForce = clamp(-maxDriveForce, drivePower / Math.abs(train.speed), +maxDriveForce);
	}
	
	let totalForwardForce = forwardForceG + driveForce;
	let trainMass = figureTrainMass(train);
	let accelleration = totalForwardForce / trainMass;
	let s0 = train.speed;
	let s1 = s0 + accelleration * interval;
	let averageSpeedDuringTick = (s1+s0)/2;
	let newPosition = addTrackPosition(train.car0TrackPosition, averageSpeedDuringTick*interval, world);
	let newPE = figureTrainPotentialEnergy(train, newPosition, world);
	let newTE:number, newKE:number, newSpeed:number;
	
	let conserveEnergy = false; //drivePower == 0;
	if( conserveEnergy ) {
		// As long as no external forces apply, explicitly conserve energy
		// so that rounding errors don't destabilize the system
		newTE = train.totalEnergy;
		newKE = newTE - newPE;
		
		newSpeed = Math.sqrt(2 * newKE / trainMass);
		// Make it the same sign as s1
		if( newSpeed * s1 < 0 ) newSpeed = -newSpeed;  
	} else {
		newSpeed = s1;
		newKE = trainMass * newSpeed*newSpeed / 2;
		newTE = newPE + newKE;
	}
	//if( newKE < 0 ) {
	//	newKE = 0;
	//}
	
	// KE = 1/2 * m * v**2
	// 2 * KE / m = v**2
	// v = sqrt(2 * KE / m) 
		
	return {
		cars: train.cars,
		totalEnergy: newTE,
		car0TrackPosition: newPosition,
		speed: newSpeed,
		
		stats: {
			driveForce,
			drivePower,
			speed: newSpeed,
			totalEnergy: newTE,
			kineticEnergy: newKE,
			potentialEnergy: newPE
		}
	}
}

function makeTrackSegment(
	previousSegmentId:TrackSegmentID, ep0:Vector2D,
	ep1:Vector2D, nextSegmentId:TrackSegmentID
):TrackSegment {
	let dx = ep1.x - ep0.x;
	let dy = ep1.y - ep0.y;
	return {
		previousSegmentId,
		endpoint0: ep0,
		endpoint1: ep1,
		length: Math.sqrt(dy*dy + dx*dx),
		nextSegmentId,
	};
}

export class CoasterSimulator {
	public world : World = {
		trackSegments: [],
		trains: [],
	}
	
	public canvas : HTMLCanvasElement|undefined;
	
	public setUpUi(canvas:HTMLCanvasElement) {
		this.canvas = canvas;
		
		let keysDown:{[k:number]: boolean} = {};
		let eatKeys:{[k:number]: boolean} = {
			37:true, 39:true // Left and right keys
		};
		const keysUpdated = () => {
			let driveDirection =
				(keysDown[39] && !keysDown[37]) ? +1 :
				(keysDown[37] && !keysDown[39]) ? -1 : 0;
			if( this.world.trains[0] && this.world.trains[0].cars[0] ) {
				let car = this.world.trains[0].cars[0];
				this.world.trains[0].cars[0].drivingPower = driveDirection * car.maxDrivingPower;
			}
		};
		window.addEventListener('keydown', (keyEvent:KeyboardEvent) => {
			//console.log("Key down: "+keyEvent.keyCode);
			if( eatKeys[keyEvent.keyCode] ) {
				keysDown[keyEvent.keyCode] = true;
				keyEvent.preventDefault();
				keysUpdated();
			}
		});
		window.addEventListener('keyup', (keyEvent:KeyboardEvent) => {
			if( eatKeys[keyEvent.keyCode] ) {
				keysDown[keyEvent.keyCode] = false;
				keyEvent.preventDefault();
				keysUpdated();
			}
		});
	}
	
	public setUpWorld() {
		// For now just make a circuilar track
		const noise = new SimplexNoise();
		const rad = 16+Math.random()*16;
		const noiseInputScale = Math.random()*3;
		const noiseOutputScale = 32;
		const segCount = 1024;
		let dir = 0;
		let position = {x:0, y:0};
		for( let i=0; i<segCount; ++i ) {
			let dirDelta = (
				noise.noise2d(i, 0) +
				2 * noise.noise2d(i/2, 0) +
				4 * noise.noise2d(i/4, 0) +
				8 * noise.noise2d(i/8, 0)
			)*1/16;
			let endPosition = {
				x: position.x + Math.cos(dir),
				y: position.y + Math.sin(dir),
			}
			this.world.trackSegments.push(makeTrackSegment(
				i == 0 ? 1023 : i-1,
				position, endPosition,
				i == 1023 ? 0 : i+1
			));
			dir = dir+dirDelta;
			position = endPosition;
		}
		let train:Train = {
			cars: [],
			totalEnergy: 0, // Will fix later
			speed: 0,
			car0TrackPosition: {
				trackSegmentId: segCount * 3 / 4,
				distanceAlongSement: 0
			}
		}
		const carCount = 1+Math.random()*32;
		for( let i=0; i<carCount; ++i ) {
			train.cars.push({
				mass: 100,
				distanceToNextCar: 1,
				brakingForce: 0,
				drivingPower: 0,
				maxDrivingPower: 10000
			})
		}
		train.totalEnergy = figureTrainTotalEnergy(train, this.world);
		this.world.trains.push(train);
	}
	
	public paint() {
		if( !this.canvas ) return;
		const canvWidth = this.canvas.width;
		const canvHeight = this.canvas.height;
		const canvCenterX = canvWidth/2;
		const canvCenterY = canvHeight/2;
		const c2d = this.canvas.getContext('2d');
		if( !c2d ) return;
		
		const scale = 16;
		let focusTrain = this.world.trains[0];
		let cx:number, cy:number;
		if( focusTrain ) {
			let carTrackPosition = focusTrain.car0TrackPosition;
			let carWorldPos = trackPositionToWorldPosition(carTrackPosition, this.world);
			cx = carWorldPos.x, cy = carWorldPos.y;
		} else {
			cx = cy = 0;
		}
		c2d.clearRect(0, 0, canvWidth, canvHeight);
		c2d.strokeStyle = 'rgb(128,192,64)';
		for( let s in this.world.trackSegments ) {
			let seg = this.world.trackSegments[s];
			let px0 = (seg.endpoint0.x - cx)*scale + canvCenterX;
			let py0 = (seg.endpoint0.y - cy)*scale + canvCenterY;
			let px1 = (seg.endpoint1.x - cx)*scale + canvCenterX;
			let py1 = (seg.endpoint1.y - cy)*scale + canvCenterY;
			c2d.beginPath();
			c2d.moveTo(px0, py0);
			c2d.lineTo(px1, py1);
			c2d.stroke();
		}
		
		for( let t in this.world.trains ) {
			let train = this.world.trains[t];
			let carTrackPosition = train.car0TrackPosition;
			let prevCarWorldPosition:Vector2D|undefined = undefined;
			for( let c=0; c<train.cars.length; ++c ) {
				let car = train.cars[c];
				let carWorldPos = trackPositionToWorldPosition(carTrackPosition, this.world);
				let px0 = (carWorldPos.x - cx)*scale + canvCenterX;
				let py0 = (carWorldPos.y - cy)*scale + canvCenterY;
				c2d.fillStyle = c == 0 ? (
					car.drivingPower == 0 ? 'rgb(204,255,128)' : 'rgb(240,255,192)'
				) : 'rgb(192,255,0)';
				c2d.fillRect(px0-scale/2, py0-scale/2, scale, scale);
				carTrackPosition = addTrackPosition(carTrackPosition, -car.distanceToNextCar, this.world);
				prevCarWorldPosition = carWorldPos;
			} 
		}
		
		const leftPad = function(v:any, width:number) {
			let s = ""+v;
			while(s.length < width) s = " "+s;
			return s;
		}
		
		let barY = 0;
		const drawBar = (title:string, value:number, maxValue:number) => {
			let barFullness = Math.abs(value) / maxValue;
			let barWidth = barFullness * canvWidth;
			c2d.fillStyle = value > 0 ? 'rgba(0,255,0,0.5)' : 'rgba(255,0,0,0.5)';
			c2d.fillRect(0, barY, barWidth, 12);
			c2d.fillStyle = 'rgba(255,255,255,0.75)';
			c2d.fillText(title+": "+leftPad(value.toFixed(2),20 - title.length), 4, barY+12);
			barY += 12;
		}
		
		let stats : TrainStats|undefined;
		if( this.world.trains[0] && (stats = this.world.trains[0].stats) ) {
			drawBar("Drive power", stats.drivePower,            100000);
			drawBar("Drive force", stats.driveForce,            100000);
			drawBar("Speed"           , stats.speed,              1000);
			drawBar("Kinetic energy", stats.kineticEnergy,     1000000);
			drawBar("Potential energy", stats.potentialEnergy, 1000000);
			drawBar("Total energy", stats.totalEnergy,         1000000);
		}
	}
	
	public tick(interval:number):void {
		for( let t in this.world.trains ) {
			this.world.trains[t] = moveTrain(this.world.trains[t], interval, this.world);
		}
		this.paint();
	}
	
	public start():void {
		const fps = 20;
		setInterval(() => this.tick(1/fps), 50);
	}
}
