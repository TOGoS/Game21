import {
	Entity
} from '../world';
import GameDataManager from '../GameDataManager';
import ImageSlice from '../ImageSlice';

export class StorageCompartmentContentUI {
	protected _entityRenderer?:(entity:Entity)=>Promise<ImageSlice<any>>;
	public constructor(  ) { }
	
	protected _element:HTMLElement;
	public get element() {
		if( this._element == null ) this._element = this.createElement();
		return this._element;
	}
	
	protected createElement():HTMLElement {
		const elem = document.createElement('div');
		elem.className = 'storage-compartment-content'
		return elem;
	}
	
	protected _items:Entity[] = [];
	protected _selectedItemIndex:number|undefined;
	protected _itemRenderPromises:Promise<ImageSlice<any>>[] = [];
	protected _itemElements:HTMLDivElement[] = [];
	protected rebuildUi() {
		this._itemElements = [];
		const elem = this.element;
		const items = this._items;
		while( elem.firstChild ) elem.removeChild(elem.firstChild);
		for( let _i=0; _i<this._items.length; ++_i ) {
			const i = _i;
			const itemElement = document.createElement('div');
			itemElement.dataset["itemIndex"] = ""+i;
			if( i == this._selectedItemIndex ) {
				itemElement.classList.add("selected");
			}
			this._itemElements.push(itemElement);
			elem.appendChild(itemElement);
		}
		this.renderItems;
	}
	
	protected renderItems() {
		const elem = this._element;
		const items = this._items;
		const itemElements = this._itemElements;
		this._itemRenderPromises = [];
		const rend = this._entityRenderer;
		for( let _i=0; _i<items.length; ++_i ) {
			const i = _i;
			const item = items[i];
			const itemElement = itemElements[i];
			if( !item || !rend ) {
				itemElement.style.backgroundImage = '';
			} else {
				const renderPromise = rend(item);
				this._itemRenderPromises.push(renderPromise);
				renderPromise.then( (slice) => {
					if( this._itemRenderPromises[i] !== renderPromise ) return;
					itemElement.style.backgroundImage = 'url("'+slice.sheetRef+'")';
				});
			}
		}
	}
	
	public setState( items:Entity[], selectedItemIndex:number|undefined ) {
		this._selectedItemIndex = selectedItemIndex;
		// Can skip the set selectedItemIndex stuff since rebuilding will take it care of
		this.items = items;
	}
	
	public set items( items:Entity[] ) {
		this._items = items;
		this.rebuildUi();
	}
	
	public set entityRenderer(renderer:(entity:Entity)=>Promise<ImageSlice<any>>) {
		this._entityRenderer = renderer;
		this.renderItems();
	}
	
	public set selectedItemIndex( index:number|undefined ) {
		if( this._selectedItemIndex == index ) return;
		if( this._selectedItemIndex != null && this._itemElements[this._selectedItemIndex] ) {
			this._itemElements[this._selectedItemIndex].classList.remove("selected");
		} 
		this._selectedItemIndex = index;
		if( index != null && this._itemElements[index] ) {
			this._itemElements[index].classList.add("selected");
		}
	}
}
