import { TileEntity, Entity } from '../world';
import Quaternion from '../Quaternion';

export default class TilePalette {
	protected tileEntities:(TileEntity|null)[];
	protected imageUrls:(string|null)[];
	protected imageUrlPromises:(Promise<string>|undefined)[];
	protected tileElements:(HTMLElement)[];
	protected _element:HTMLElement;
	protected _selectedSlotIndex:number = 0;
	
	public constructor(
		slotCount:number,
		protected renderer:(ent:Entity, orientation:Quaternion)=>Promise<string|null>
	) {
		this.tileEntities = new Array(slotCount);
		this.imageUrls = new Array(slotCount);
		this.imageUrlPromises = new Array(slotCount);
		this.tileElements = new Array(slotCount);

		const tab = this._element = document.createElement('ul');
		tab.className = "tile-palette";
		for( let i=0; i<this.tileEntities.length; ++i ) {
			const li = this.tileElements[i] = document.createElement('li');
			if( i == this._selectedSlotIndex ) li.className = "selected";
			const label = document.createTextNode(""+i);
			li.appendChild(label);
			const _i = i;
			li.addEventListener('click', (evt:MouseEvent) => {
				this.selectSlot(_i);
			});
			tab.appendChild(li);
		}
	}
	
	public get element() { return this._element; }
	
	public setSlot( index:number, entity:TileEntity|string|null ) {
		if( typeof entity == 'string' ) {
			entity = {
				entity: { classRef: entity },
				orientation: Quaternion.IDENTITY
			};
		}
		if( entity == null ) {
			this.imageUrls[index] = null;
			this.tileElements[index].style.backgroundImage = null;
			this.imageUrlPromises[index] = undefined;
			return;
		}
		if( JSON.stringify(entity) != JSON.stringify(this.tileEntities[index]) ) {
			this.tileEntities[index] = entity;
			this.imageUrls[index] = null;
			const renderP = this.renderer( entity.entity, entity.orientation );
			this.imageUrlPromises[index] = renderP;
			renderP.then( (url) => {
				if( this.imageUrlPromises[index] === renderP ) {
					this.imageUrls[index] = url;
					this.tileElements[index].style.backgroundImage = url ? "url('"+url+"')" : null;
				}
			});
		}
	}
	
	protected selectListeners:Array<(index:number, te:TileEntity|null)=>void> = [];
	
	public get selectedSlotIndex():number { return this._selectedSlotIndex; }
	
	public selectSlot( index:number ):void {
		if( index == this._selectedSlotIndex ) return;
		this.tileElements[this._selectedSlotIndex].className = '';
		this.tileElements[index].className = 'selected';
		this._selectedSlotIndex = index;
		for( let t in this.selectListeners ) {
			this.selectListeners[t]( index, this.tileEntities[index] );
		}
	}
	
	public on(event:"select", then:(index:number, te:TileEntity|null)=>void):void {
		this.selectListeners.push(then);
	}
}
