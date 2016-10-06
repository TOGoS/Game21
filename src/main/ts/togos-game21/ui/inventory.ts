import {
	Entity
} from '../world';
import GameDataManager from '../GameDataManager';
import ImageSlice from '../ImageSlice';

function emptyElement(e:HTMLElement) {
	while( e.firstChild ) e.removeChild(e.firstChild);
}

type EntityRenderer = (entity:Entity)=>Promise<ImageSlice<any>>;

interface UIContext {
	gameDataManager:GameDataManager;
	entityRenderer:EntityRenderer;
}

export class StorageCompartmentContentUI {
	protected _entityRenderer?:EntityRenderer;
	public constructor( ctx?:UIContext ) {
		if( ctx ) this._entityRenderer = ctx.entityRenderer;
	}
	
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
	
	public set uiContext(ctx:UIContext) {
		this.entityRenderer = ctx.entityRenderer;
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

/*
 * A 'selection path' is a string of sub-object IDs and/or indexes.
 * A sub-object ID may refer to an attachment or a storage compartment.
 * If it refers to a storage compartment, the next element is an item index.
 */
type SelectionPath = any[];

interface EntityInventoryChain {
	entity: Entity;
	selectionPath: SelectionPath;
}

export class EntityInventoryUI {
	protected _uiContext:UIContext;
	public constructor( ctx:UIContext ) {
		this._uiContext = ctx;
	}
	
	public set chain(c:EntityInventoryChain) {
		
	}
	
	public get chainTail():EntityInventoryChain|null {
		return null;
	}
}

/**
 * UI component for a single root entity,
 * which includes sub-item ineventories 
 */
export class InventoryRowUI {
	protected _uiContext:UIContext;
	protected _chain:EntityInventoryChain;
	public constructor( ctx:UIContext ) {
		this._uiContext = ctx;
	}
	
	protected createElement():HTMLElement {
		const elem = document.createElement('div');
		elem.className = 'inventory'
		return elem;
	}
	
	protected _element:HTMLElement;
	public get element() {
		if( this._element == null ) this._element = this.createElement();
		return this._element;
	}
	
	protected _entityInventoryUis:EntityInventoryUI[] = [];
	public rebuildUi() {
		emptyElement(this._element);
		this._entityInventoryUis = [];
		let chain:EntityInventoryChain|null = this._chain;
		while( chain ) {
			const eiui = new EntityInventoryUI(this._uiContext);
			this._entityInventoryUis.push(eiui);
			chain = eiui.chainTail;
		}
	}
	
	public set chain(chain:EntityInventoryChain) {
		this._chain = chain;
		this.rebuildUi();
	}
}

/**
 * Encapsulates several inventory row UIs, each for a different root entity
 */
export class InventoryUI {
	protected _uiContext:UIContext;
	
	protected createElement():HTMLElement {
		const elem = document.createElement('div');
		elem.className = 'inventory'
		return elem;
	}
	
	protected _element:HTMLElement;
	public get element() {
		if( this._element == null ) this._element = this.createElement();
		return this._element;
	}
	
	protected _chains:EntityInventoryChain[] = [];
	protected _rootEntityRowUis:InventoryRowUI[] = [];
	protected _rootEntityElements:HTMLElement[] = [];
	
	public rebuildUi() {
		this._rootEntityRowUis = [];
		const rootElem = this.element;
		emptyElement(rootElem);
		for( let _i in this._chains ) {
			const rowUi = new InventoryRowUI(this._uiContext);
			rowUi.chain = this._chains[_i];
			this._rootEntityRowUis.push(rowUi);
			rootElem.appendChild(rowUi.element);
		}
	}
	
	public set uiContext(ctx:UIContext) {
		this._uiContext = ctx;
		this.rebuildUi();
	}
	
	public set chains(chains:EntityInventoryChain[]) {
		this._chains = chains;
		this.rebuildUi(); // Eventually only rebuild the changed parts!
	}
}
