import { TileEntity, Entity } from '../world';
import Quaternion from '../Quaternion';

export interface PaletteItem {
	key?: string; // To map to world inventory, which is different
	entity: Entity;
	orientation: Quaternion;
}

export default class TilePalette {
	protected tileEntities:(PaletteItem|undefined)[];
	protected imageUrls:(string|null)[];
	protected imageUrlPromises:(Promise<string>|undefined)[];
	protected tileElements:(HTMLElement)[];
	protected _element:HTMLElement;
	protected _selectedSlotIndex:number = 0;
	
	public constructor(
		slotCount:number,
		protected _renderer?:(ent:Entity, orientation:Quaternion)=>Promise<string|null>
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
	
	protected renderSlot( index:number ) {
		const tileEntity = this.tileEntities[index];
		if( tileEntity == null ) {
			this.imageUrls[index] = null;
			this.imageUrls[index] = null;
			this.tileElements[index].style.backgroundImage = null;
		} else if( this._renderer ) {
			const renderP = this._renderer( tileEntity.entity, tileEntity.orientation );
			this.imageUrlPromises[index] = renderP;
			renderP.then( (url) => {
				if( this.imageUrlPromises[index] === renderP ) { // Still waiting for me?
					this.imageUrls[index] = url;
					this.tileElements[index].style.backgroundImage = url ? "url('"+url+"')" : null;
				}
			}, (err) => {
				console.error(
					"Failed to render entity for slot "+index+", class = "+tileEntity.entity.classRef+";",
					err
				);
				this.imageUrls[index] = null;
				this.tileElements[index].style.background = "red";
			});
		} else {
			console.warn("Can't render tiles; no renderer configured on tile palette")
		}
	}
	
	public setSlot( index:number, _entity:TileEntity|string|null ) {
		if( typeof _entity == 'string' ) {
			_entity = {
				entity: { classRef: _entity },
				orientation: Quaternion.IDENTITY
			};
		}
		const tileEntity = _entity;
		if( tileEntity == null ) {
			this.tileEntities[index] = null;
			this.renderSlot(index);
			this.imageUrlPromises[index] = undefined;
		} else if( JSON.stringify(tileEntity) != JSON.stringify(this.tileEntities[index]) ) {
			this.tileEntities[index] = tileEntity;
			this.imageUrls[index] = null;
			this.renderSlot(index);
		}
		this.triggerSelectListeners();
	}
	
	public setAllSlots( entities:TileEntity[] ) {
		for( let i=0; i<this.tileEntities.length; ++i ) {
			this.setSlot(i, entities[i]);
		}
	}
	
	protected triggerSelectListeners() {
		for( let t in this.selectListeners ) {
			this.selectListeners[t]( this._selectedSlotIndex, this.tileEntities[this._selectedSlotIndex] );
		}
	}
	
	protected selectListeners:Array<(index:number, te:TileEntity|null)=>void> = [];
	
	public get selectedSlotIndex():number { return this._selectedSlotIndex; }
	public get selectedItem():PaletteItem|undefined {
		return this.tileEntities[this._selectedSlotIndex];
	}
	public get selectedItemKey():string|undefined {
		const item = this.selectedItem;
		return (item == null) ? undefined : item.key;
	}
	
	public selectSlot( index:number ):void {
		if( index == this._selectedSlotIndex ) return;
		this.tileElements[this._selectedSlotIndex].className = '';
		this.tileElements[index].className = 'selected';
		this._selectedSlotIndex = index;
		this.triggerSelectListeners();
	}
	
	public on(event:"select", then:(index:number, te:TileEntity|null)=>void):void {
		this.selectListeners.push(then);
	}
	
	public set entityRenderer(renderer:((ent:Entity, orientation:Quaternion)=>Promise<string|null>)|undefined) {
		this._renderer = renderer;
		this.rerenderAll();
	}
	
	protected rerenderAll() {
		for( let i=0; i<this.tileEntities.length; ++i ) {
			this.renderSlot(i);
		}
	}
}
