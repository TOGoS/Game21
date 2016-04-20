/**
 * [Attempt at a] drop-in replacement for requireJS
 * for when you control the loading of all the files
 * and can guarantee that all needed dependencies exist.
 * 
 * define( name, dependencies, callback );
 * ....
 * require( [someModuleName], function(someModule) { } );
 */
var fakerequire = (function() {
	var modules = {};
	var define = function(name, deps, callback) {
		modules[name] = { dependencies: deps, callback: callback, exports: undefined };
	};
	var resolveDeps = function(depNames, overrides) {
		var deps = [];
		for( var d in depNames ) {
			var depName = depNames[d];
			var v;
			if( overrides[depName] !== undefined ) {
				v = overrides[depName];
			} else {
				v = getModuleExports(depName);
			}
			deps.push(v);
		}
		return deps;
	};
	var getModuleExports = function(name) {
		var module = modules[name];
		if( !module ) throw new Error("No module '"+name+"' defined");
		if( module.exports === undefined ) {
			module.exports = {};
			var deps = resolveDeps( module.dependencies, {exports: module.exports, require: null} );
			module.callback.apply(module.callback, deps);
		}
		return module.exports;
	};
	var require = function(depNames, callback, errback) {
		var exports = {};
		var args;
		if( errback ) {
			try {
				args = resolveDeps(depNames, { exports: exports, require: null });
			} catch( e ) {
				errback(e);
			}
		} else {
			args = resolveDeps(depNames, { exports: exports, require: null });
		}
		
		callback.apply(callback, args);
	};
	
	return {
		define: define,
		require: require
	};
})();

window.define = fakerequire.define;
window.require = fakerequire.require;
