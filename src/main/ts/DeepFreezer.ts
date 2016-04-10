declare function Symbol(x:string);

//// Object cloning utilities

var identity = function(x) { return x; };

var _map = function<T>(from:T, to:T, mapFunc:(any)=>any) {
	Object.getOwnPropertyNames(from).forEach(function(k) {
		to[k] = mapFunc(from[k]);
	});
};

var map = function<T>(obj:T, mapFunc:(any)=>any) {
	//var clone = {}; // Loses too much information!
	//var clone = Object.create(Object.getPrototypeOf(obj)); // Fails to construct arrays right, so length becomes enumerable
	var prototype = Object.getPrototypeOf(obj);
	var constructor = prototype.constructor;
	if( constructor.createFrom ) {
		var props = {};
		_map(obj, props, mapFunc);
		return constructor.createFrom(props);
	} else {
		var clone = new (prototype.constructor)();
		_map(obj, clone, mapFunc);
		return clone;
	}
};

var clone = function<T>(obj:T):T {
	return map(obj, identity);
};

////

var deepFrozen = Symbol("deeply frozen");

var isDeepFrozen = function(val) {
	return !!((typeof val !== 'function' && typeof val !== 'object') || val === null || val[deepFrozen]);
};

/**
 * Differs from object.feeze only in that this will add the deepFrozen
 * property if the object happens to be deep frozen.
 * 
 * Why would you use this instead of deepFreeze?
 * Probably shouldn't.
 */
var freeze = function<T>(obj:T, inPlace:boolean=false):T {
	if( Object.isFrozen(obj) ) return obj;
	
	var hasAnyMutableProperties = false;
	Object.getOwnPropertyNames(obj).forEach(function(k) {
		if( !isDeepFrozen(obj[k]) ) {
			hasAnyMutableProperties = true;
		}
	});
	var frozenObj = inPlace ? obj : clone(obj);
	if( !hasAnyMutableProperties ) frozenObj[deepFrozen] = true;
	return Object.freeze(frozenObj);
};

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
var deepFreeze = function<T>(obj:T, inPlace:boolean=false):T {
	if( isDeepFrozen(obj) ) return obj;
	
	// If it ain't /deep frozen/ we're going to have
	// to thaw it at least to add the deepFrozen property.
	obj = thaw(inPlace ? obj : clone(obj));
	_map( obj, obj, deepFreeze );
	obj[deepFrozen] = true;
	Object.freeze(obj);
	return obj;
};

var thaw = function<T>(obj:T):T {
	if( !Object.isFrozen(obj) ) return obj;
	if( typeof obj !== 'object' && typeof obj !== 'function' ) return obj;
	return map(obj, identity);
};

var deepThaw = function<T>(obj:T):T {
	obj = thaw(obj);
	_map(obj, obj, thaw);
	return obj;
};

var myOwnCopyOf = function<T>(obj:T):T {
	return deepThaw(deepFreeze(obj,false));
};

export default {
	// Stuff I'm making public because it's handy for my other
	// libraries, especially when dealing with deep frozen stuff
	map: map,
	clone: clone,
	
	// Our API
	freeze: freeze,
	deepFreeze: deepFreeze,
	isDeepFrozen: isDeepFrozen,
	thaw: thaw,
	deepThaw: deepThaw,
	myOwnCopyOf: myOwnCopyOf
};
