import AABB from './AABB';
import { deepFreeze } from './DeepFreezer';
import Vector3D from './Vector3D';

export function makeAabb( minX:number, minY:number, minZ:number, maxX:number, maxY:number, maxZ:number ):AABB {
	return {minX,minY,minZ,maxX,maxY,maxZ};
}
export function setAabb( aabb:AABB|undefined|null, minX:number, minY:number, minZ:number, maxX:number, maxY:number, maxZ:number ):AABB {
	if( !aabb ) return makeAabb(minX,minY,minZ,maxX,maxY,maxZ);
	aabb.minX = minX; aabb.minY = minY;	aabb.minZ = minZ;
	aabb.maxX = maxX; aabb.maxY = maxY; aabb.maxZ = maxZ;
	return aabb;
}
export function aabbWidth(  aabb:AABB ) { return aabb.maxX-aabb.minX; }
export function aabbHeight( aabb:AABB ) { return aabb.maxY-aabb.minY; }
export function aabbDepth(  aabb:AABB ) { return aabb.maxZ-aabb.minZ; }
export function aabbAverageX(  aabb:AABB ) { return (aabb.maxX+aabb.minX)/2; }
export function aabbAverageY(  aabb:AABB ) { return (aabb.maxY+aabb.minY)/2; }

export function aabbIntersectsWithOffset( aPos:Vector3D, aBb:AABB, bPos:Vector3D, bBb:AABB ):boolean {
	if( aPos.x + aBb.maxX <= bPos.x + bBb.minX ) return false;
	if( aPos.x + aBb.minX >= bPos.x + bBb.maxX ) return false;
	if( aPos.y + aBb.maxY <= bPos.y + bBb.minY ) return false;
	if( aPos.y + aBb.minY >= bPos.y + bBb.maxY ) return false;
	if( aPos.z + aBb.maxZ <= bPos.z + bBb.minZ ) return false;
	if( aPos.z + aBb.minZ >= bPos.z + bBb.maxZ ) return false;
	return true;
}

export function aabbContainsVector( bb:AABB, v:Vector3D ):boolean {
	if( v.x < bb.minX ) return false;
	if( v.y < bb.minY ) return false;
	if( v.z < bb.minZ ) return false;
	if( v.x > bb.maxX ) return false;
	if( v.y > bb.maxY ) return false;
	if( v.z > bb.maxZ ) return false;
	return true;
}

export const UNIT_CUBE:AABB = deepFreeze(makeAabb(-0.5,-0.5,-0.5, +0.5,+0.5,+0.5));
