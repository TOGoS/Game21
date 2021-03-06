"use strict";

const fs = require('fs');
const _builder = require('./src/build/js/Builder');
const builder = new _builder.Builder();
const _fsutil = require('./src/build/js/FSUtil');
const readDir = _fsutil.readDir;
const rmRf = _fsutil.rmRf;

/**
 * Removes '//# sourceMapping' lines
 * and makes sure there's a trailing "\n"
 */
function filterJs( js ) {
	let lines = js.split("\n");
	let result = "";
	for( let i=0; i<lines.length; ++i ) {
		if( /^\s*\/\/# sourceMapping/.exec(lines[i]) ) {
			// skip it!
			continue;
		}
		result += lines[i]+"\n";
	}
	return result;
}
function _concatJsFile( file, outputStream ) {
	return new Promise( (resolve,reject) => {
		fs.readFile( file, {encoding:"utf-8"}, (err,data) => {
			if( err ) { reject(err); return; }
			
			let fixed = filterJs(data);
			outputStream.write(fixed);
			resolve();
		});
	});
}
function _concatJsFiles( files, outputStream, start ) {
	if( start >= files.length ) return Promise.resolve();
	if( start == undefined ) start = 0;
	
	return _concatJsFile(files[start], outputStream).then( () => _concatJsFiles(files, outputStream, start+1))
}
/**
 * Concatenate a bunch of JS files, removing //# sourceMapping lines and ensuring files are "\n"-terminated.
 * Returns Promise that resolves to void when done.
 */
function concatJsFiles( files, outputFile ) {
	return new Promise( (resolve,reject) => {
		let stream = fs.createWriteStream(outputFile);
		
		stream.on('error', reject);
		stream.on('close', () => resolve() );
		
		return _concatJsFiles(files, stream).then( () => {
			stream.close();
		});
	});
}

const amdComponentFiles = [
	"node_modules/tshash/target/tshash.amd.es5.js",
	"target/game21libs.amd.es5.js"
];

builder.targets = {
	"default": {
		prereqs: ["js-libs"]
	},
	"sortaclean": {
		invoke: (ctx) => rmRf('node_modules')
	},
	"clean": {
		invoke: (ctx) => rmRf(['node_modules','target'])
	},
	"node_modules": {
		prereqs: ["package.json"],
		invoke: (ctx) => ctx.builder.npm(["install"]),
		isDirectory: true,
	},
	"node_modules/tshash/target/tshash.amd.es5.js": {
		prereqs: ["node_modules"],
		invoke: (ctx) => ctx.builder.doCmd("make target/tshash.amd.es5.js", {cwd:'node_modules/tshash'})
	},
	"src": {
		isDirectory: true,
	},
	"target/cjs": {
		prereqs: ["src", "node_modules"],
		invoke: (ctx) => ctx.builder.tsc(["-p","src/main/ts/game21libs.cjs.es5.tsconfig.json","--outDir",ctx.targetName]),
		isDirectory: true,
	},
	"target/game21libs.amd.es5.js": {
		prereqs: ["src", "node_modules"],
		invoke: (ctx) => ctx.builder.tsc(["-p","src/main/ts/game21libs.amd.es5.tsconfig.json","--outFile",ctx.targetName]),
		isDirectory: false,
	},
	"target/alllibs.amd.es5.js": {
		prereqs: amdComponentFiles,
		// Stupid TypeScript emits amd files without a newline at the end,
		// so we can't just use cat; sed -e '$s/$/\\n/' adds one.
		invoke: (ctx) => concatJsFiles(ctx.prereqNames, ctx.targetName),
	},
	"demos/RandomMazes.html": {
		prereqs: ["demos/Maze1.php","target/alllibs.amd.es5.js"],
		invoke: (ctx) => ctx.builder.doCmd("php demos/Maze1.php tabSwitchesMode=false --inline-resources > "+ctx.targetName)
	},
	"run-unit-tests": {
		isFile: false,
		prereqs: ["target/cjs"],
		invoke: (ctx) => ctx.builder.doCmd("find target/cjs -name \"*Test.js\" | xargs -n 1 node")
	},
	"run-unit-tests-verbosely": {
		isFile: false,
		prereqs: ["target/cjs"],
		invoke: (ctx) => ctx.builder.doCmd("find target/cjs -name \"*Test.js\" | xargs -n 1 -I\"{}\" node \"{}\" -v")
	},
	"run-router": {
		isFile: false,
		prereqs: ["target/cjs"],
		invoke: (ctx) => ctx.builder.doCmd("node target/cjs/togos-game21/Router.js"),
	},
	"js-libs": {
		isFile: false,
		prereqs: ["target/cjs", "target/alllibs.amd.es5.js"]
	},
	"run-ethernet-simulation-demo": {
		isFile: false,
		prereqs: ["target/cjs"],
		invoke: (ctx) => ctx.builder.doCmd([
			"node","target/cjs/togos-game21/sock/AdvancedNetworkDeviceShell.js",
			"udp-server:77881|log:in:out|switch0=ethernet-switch",
			"switch1=ethernet-switch|log:switch1>switch0:switch0>switch1|switch0",
			"switch2=ethernet-switch|log:switch2>switch0:switch0>switch2|switch0",
			"switch2|log:switch2>switch1:switch1>switch2|switch1",
			"abc=junk-spammer:000def000abcyo|log:abc>switch0:switch0>abc|switch0",
			"def=junk-spammer:000abc000defhi|log:def>switch1:switch1>def|switch1",
			"rep=repeater|log:rep>switch2:switch2>rep|switch2"
		]),
	}
}

builder.fetchGeneratedTargets = function() {
	let generatedTargets = {};
	return readDir('demos').then( (demoFiles) => {
		for( let f in demoFiles ) {
			let file = 'demos/'+demoFiles[f];
			if( file.substr(file.length-4) == '.php' ) {
				generatedTargets[file.substr(0,file.length-4)+'.html'] = {
					isFile: true,
					prereqs: [file, "target/alllibs.amd.es5.js", "demos/lib.php"],
					invoke: (ctx) => {
						return ctx.builder.doCmd("php "+ctx.prereqNames[0]+" > "+ctx.targetName);
					}
				}
				generatedTargets[file.substr(0,file.length-4)+'-standalone.html'] = {
					isFile: true,
					prereqs: [file, "target/alllibs.amd.es5.js", "demos/lib.php"],
					invoke: (ctx) => {
						return ctx.builder.doCmd("php "+ctx.prereqNames[0]+" --inline-resources > "+ctx.targetName);
					}
				}
			}
		}
		return generatedTargets;
	});
}

// If build.js has changed, assume everything else is out of date!
builder.globalPrereqs = ['build.js', 'src/build/js/Builder.js'];

builder.processCommandLineAndSetExitCode(process.argv.slice(2));
