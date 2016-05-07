import Vector3D from './Vector3D';
import { Game, PhysicalObject, PhysicalObjectType, TileTree } from './world';

const posBuffer0:Vector3D=new Vector3D;

// 'game' is used to look up tile palettes/object prototypes by UUID.
// Could be replaced with some accessor thingy, possibly asynchronous.
export function eachSubObject( obj:PhysicalObject, pos:Vector3D, game:Game, callback:(subObj:PhysicalObject, pos:Vector3D)=>void, callbackThis:any=null, posBuffer:Vector3D=posBuffer0 ) {
	if( obj.type == PhysicalObjectType.INDIVIDUAL ) {
		// No sub-objects!
	} else if( obj.type == PhysicalObjectType.TILE_TREE ) {
		const tt:TileTree = <TileTree>obj;
		const tilePaletteIndexes = tt.childObjectIndexes;
		const tilePalette = game.tilePalettes[tt.childObjectPaletteRef];
		const objectPrototypes = game.objectPrototypes;
		const xd = tt.tilingBoundingBox.width/tt.xDivisions;
		const yd = tt.tilingBoundingBox.height/tt.yDivisions;
		const zd = tt.tilingBoundingBox.depth/tt.zDivisions;
		const x0 = pos.x - tt.tilingBoundingBox.width/2  + xd/2;
		const y0 = pos.y - tt.tilingBoundingBox.height/2 + yd/2;
		const z0 = pos.z - tt.tilingBoundingBox.depth/2  + zd/2;
		for( let i=0, z=0; z < tt.zDivisions; ++z ) for( let y=0; y < tt.yDivisions; ++y ) for( let x=0; x < tt.xDivisions; ++x, ++i ) {
			const childId = tilePalette[tilePaletteIndexes[i]];
			if( childId != null ) {
				const child = objectPrototypes[childId];
				callback.call( callbackThis, child, posBuffer.set(x0+x*xd, y0+y*yd, z0+z*zd) );
			}
		}
	} else {
		throw new Error("Unrecognized physical object type: "+obj.type);
	}
}