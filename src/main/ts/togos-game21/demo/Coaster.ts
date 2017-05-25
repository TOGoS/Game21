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
	divingForce : number; // They can self-propel, I guess!
	brakingForce : number; // Force that is only applied to stop motion along the track
	distanceToNextCar : number;
}

interface Train {
	cars : TrainCar[];
	/** Total kinetic + potential energy of the train */
	totalEnergy : number;
	car0TrackPosition : TrackPosition;
	/** Speed forward along track */
	speed : number;
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

/** Return the amount of forward force on the train */
function figureTrainForce( train:Train, world:World ):number {
	let forwardForce = 0;
	let carTrackPosition:TrackPosition = train.car0TrackPosition;
	for( let c in train.cars ) {
		const car = train.cars[c];
		
		forwardForce += car.divingForce;
		let segment = world.trackSegments[carTrackPosition.trackSegmentId];
		// fAlong/fG = distY/distAlong
		// fAlong = fG * distY / distAlong
		// Remember that +Y is down!
		const fG = 9.8 * car.mass;
		forwardForce += fG * (segment.endpoint1.y - segment.endpoint0.y) / segment.length;  
		
		carTrackPosition = addTrackPosition(carTrackPosition, car.distanceToNextCar, world);
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
		pe -= car.mass * carPos.y; // Minus because -y is higher PE
		carTrackPosition = addTrackPosition(carTrackPosition, car.distanceToNextCar, world); 
	}
	return pe;
}

function figureTrainTotalEnergy( train:Train, world:World ):number {
	let mass = figureTrainMass(train);
	let ke = mass * train.speed*train.speed / 2;
	return ke + figureTrainPotentialEnergy(train, train.car0TrackPosition, world);
}	

function moveTrain( train:Train, interval:number, world:World ):Train {
	let forwardForce = figureTrainForce(train, world);
	let trainMass = figureTrainMass(train);
	let accelleration = forwardForce / trainMass;
	let s0 = train.speed;
	let s1 = s0 + accelleration * interval;
	let sAve = (s1+s0)/2;
	let newPosition = addTrackPosition(train.car0TrackPosition, sAve*interval, world);
	let newPE = figureTrainPotentialEnergy(train, newPosition, world);
	let newKE = train.totalEnergy - newPE;
	if( newKE < 0 ) {
		// Well, if we added energy by engines we'd need to add it to totalEnergy! 
		newKE = 0;
		// debugger;
	}
	
	// KE = 1/2 * m * v**2
	// 2 * KE / m = v**2
	// v = sqrt(2 * KE / m) 
	
	let adjustedSpeed = Math.sqrt(2 * newKE / trainMass);
	// Make it the same sign as s1
	if( adjustedSpeed * s1 < 0 ) adjustedSpeed = -adjustedSpeed;  
	
	return {
		cars: train.cars,
		totalEnergy: train.totalEnergy,
		car0TrackPosition: newPosition,
		speed: adjustedSpeed,
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
	
	public setUpWorld() {
		// For now just make a circuilar track
		const noise = new SimplexNoise();
		const rad = 16+Math.random()*16;
		const noiseInputScale = Math.random()*3;
		const noiseOutputScale = 32;
		const segCount = 1024;
		for( let i=0; i<segCount; ++i ) {
			const cp0 = { x: Math.cos((i+0)*Math.PI*2/segCount), y: Math.sin((i+0)*Math.PI*2/segCount) };
			const cp1 = { x: Math.cos((i+1)*Math.PI*2/segCount), y: Math.sin((i+1)*Math.PI*2/segCount) };
			this.world.trackSegments.push(makeTrackSegment(
				i == 0 ? 1023 : i-1,
				{
					x:rad*cp0.x + noiseOutputScale*noise.noise2d(noiseInputScale*cp0.x, noiseInputScale*cp0.y),
					y:rad*cp0.y + noiseOutputScale*noise.noise2d(noiseInputScale*cp0.y, noiseInputScale*cp0.x)
				},
				{
					x:rad*cp1.x + noiseOutputScale*noise.noise2d(noiseInputScale*cp1.x, noiseInputScale*cp1.y),
					y:rad*cp1.y + noiseOutputScale*noise.noise2d(noiseInputScale*cp1.y, noiseInputScale*cp1.x)
				},
				i == 1023 ? 0 : i+1
			))
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
				divingForce: 0,
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
				c2d.fillStyle = c == 0 ? 'rgb(204,255,128)' : 'rgb(192,255,0)';
				c2d.fillRect(px0-scale/2, py0-scale/2, scale, scale);
				carTrackPosition = addTrackPosition(carTrackPosition, car.distanceToNextCar, this.world);
				prevCarWorldPosition = carWorldPos;
			} 
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
