import Vector3D from './Vector3D';
import Rectangle, {RectangularBounds} from './Rectangle';
import Cuboid from './Cuboid';
import { Game, Room } from './world';

/*
 * Opactity map gives opacity of each cell
 * 
 * Shade map gives visibility of each cell corner
 */

class ShadeMap {
	public data:Uint8Array;
	
	constructor(public resolution:number, public width:number, public height:number, public originX:number, public originY:number ) {
		this.data = new Uint8Array(width*height);
	}
	
	/**
	 * If dest is a cuboid, set dest.{min,max}Z as you see fit (-0.5 to +0.5, maybe)
	 */
	public getBounds<T extends RectangularBounds>(dest:T):T {
		dest.minX = -this.originX;
		dest.minY = -this.originY;
		dest.maxX = this.resolution*this.width - this.originX;
		dest.maxY = this.resolution*this.height - this.originY;
		return dest;
	}
}

const mapBoundsBuffer:Cuboid = new Cuboid;
const objPosBuf:Vector3D = new Vector3D;
const objBB = new Cuboid;

class RoomShader {
	public shareMap( opacityMap:ShadeMap, dest:ShadeMap ):ShadeMap {
		dest.data.fill(0);
		return dest;
	}
	
	protected fillRoomOpacityMap( room:Room, pos:Vector3D, game:Game, dest:ShadeMap, destBounds:Cuboid ) {
		for( let o in room.objects ) {
			const obj = room.objects[o];
			Vector3D.add(pos, obj.position, objPosBuf);
			const vbb = obj.visualBoundingBox;
			if( objPosBuf.x + vbb.maxX <= destBounds.minX ) continue;
			if( objPosBuf.y + vbb.maxY <= destBounds.minY ) continue;
			if( objPosBuf.x + vbb.minX >= destBounds.maxX ) continue;
			if( objPosBuf.x + vbb.minY >= destBounds.maxY ) continue;
			if( objPosBuf.z + vbb.maxZ <= destBounds.minZ ) continue;
			
			switch( obj.type ) { /* TODO */ }
		}
	}
	
	public roomOpacityMap( roomRef:string, pos:Vector3D, game:Game, dest:ShadeMap ):ShadeMap {
		dest.data.fill(0);
		
		const destBounds = dest.getBounds(mapBoundsBuffer);
		destBounds.minZ = -0.5;
		destBounds.maxX = +0.5;
		
		const room = game.rooms[roomRef];
		this.fillRoomOpacityMap(room, pos, game, dest, destBounds);
		// TODO: stff
		
		return dest;
	}
}
