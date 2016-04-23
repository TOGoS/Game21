declare function Symbol(x:string):symbol;

//// Object cloning utilities

var identity = function<T>(x:T):T { return x; };

var _map = function<T,P>(from:T, to:T, mapFunc:(t:any,p:P)=>any, mapFuncParam:P):void {
	Object.getOwnPropertyNames(from).forEach(function(k) {
		(<any>to)[k] = mapFunc((<any>from)[k], mapFuncParam);
	});
};

var map = function<T,P>(obj:T, mapFunc:(t:any,p:P)=>any, mapFuncParam:P):T {
	//var clone = {}; // Loses too much information!
	//var clone = Object.create(Object.getPrototypeOf(obj)); // Fails to construct arrays right, so length becomes enumerable
	var prototype = Object.getPrototypeOf(obj);
	var constructor = prototype.constructor;
	if( constructor.createFrom ) {
		var props = {};
		_map(obj, props, mapFunc, mapFuncParam);
		return constructor.createFrom(props);
	} else {
		var clone = new (prototype.constructor)();
		_map(obj, clone, mapFunc, mapFuncParam);
		return clone;
	}
};

var clone = function<T>(obj:T):T {
	return map(obj, identity, null);
};

////

type DeepFreezeID = number;

const deepFrozen = Symbol("deep freeze ID");

function isFrozen(obj:any) {
	if( Object.isFrozen(obj) ) return true;
	// But!  Some objects we want to treat as frozen even though we can't Object.freeze them.
	// Like array buffer arrays.
	if( obj[deepFrozen] ) return true;
	return false;
}

export function isDeepFrozen(val:any):boolean {
	return !!((typeof val !== 'function' && typeof val !== 'object') || val === null || val[deepFrozen]);
};

export function deepFreezeIdUnchecked(val:any):DeepFreezeID {
	return val[deepFrozen];
}

export function deepFreezeId(val:any):DeepFreezeID {
	if( (typeof val !== 'function' && typeof val !== 'object') ) throw new Error("Only objects and functions can have a deepFreezeId.  Given a "+typeof(val));
	if( val[deepFrozen] == null ) throw new Error("Object lacks a deep freeze ID");
	return deepFreezeIdUnchecked(val);
}

/**
 * Differs from object.feeze only in that this will add the deepFrozen
 * property if the object happens to be deep frozen.
 * 
 * Why would you use this instead of deepFreeze?
 * Probably shouldn't.
 */
export function freeze<T>(obj:T, inPlace:boolean=false):T {
	if( isFrozen(obj) ) return obj;
	
	var hasAnyMutableProperties = false;
	Object.getOwnPropertyNames(obj).forEach(function(k) {
		if( !isDeepFrozen((<any>obj)[k]) ) {
			hasAnyMutableProperties = true;
		}
	});
	var frozenObj = inPlace ? obj : clone(obj);
	if( !hasAnyMutableProperties ) (<any>frozenObj)[deepFrozen] = ++lastFreezeId;
	return Object.freeze(frozenObj);
};

let lastFreezeId = 0;

function isObjectFreezable(obj:any):boolean {
	if( obj.buffer instanceof ArrayBuffer ) return false; // "Cannot freeze array buffer views" says Chrome.
	return true;
}

/**
 * Return either the object or a clone of it that is deep frozen.
 * To ensure that your exiting object remains mutable (assuming it is),
 * pass true to the (slightly misnamed) newInstance parameter.
 * 
 * @param {object} obj the object to freeze
 * @param {boolean} inPlace true if you want to allow the object to be frozen in-place;
 *   otherwise, the original object is left as-is and any freezing would be done on a new object.
 *   Note that even when true, this does not guarantee that the object will be deep-frozen in-place;
 *   If the object is frozen but not deep-frozen, for example, a new instance will be returned.
 *   Also note that passing false does not guarantee a new instance;
 *   If the object is already deep-frozen, that same object will be returned.
 */
export function deepFreeze<T>(obj:T, allowInPlace:boolean=false):T {
	if( isDeepFrozen(obj) ) return obj;
	
	// If it ain't /deep frozen/ we're going to have
	// to thaw it at least to add the deepFrozen property.
	obj = thaw(allowInPlace ? obj : clone(obj));
	_map( obj, obj, deepFreeze, allowInPlace );
	(<any>obj)[deepFrozen] = ++lastFreezeId;
	if( isObjectFreezable(obj) ) Object.freeze(obj);
	return obj;
};

export function thaw<T>(obj:T):T {
	if( !isFrozen(obj) ) return obj;
	if( typeof obj !== 'object' && typeof obj !== 'function' ) return obj;
	return map(obj, identity, null);
};

export function deepThaw<T>(obj:T):T {
	obj = thaw(obj);
	_map(obj, obj, thaw, null);
	return obj;
};

export function myOwnCopyOf<T>(obj:T):T {
	return deepThaw(deepFreeze(obj,false));
};
