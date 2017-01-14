"use strict";

const _builder = require('./src/build/js/Builder');
const builder = new _builder.Builder();
const readDir = _builder.readDir;

builder.targets = {
	"default": {
		prereqs: ["js-libs"]
	},
	"sortaclean": {
		invoke: (ctx) => ctx.builder.doCmd(['rm','-rf','node_modules'])
	},
	"clean": {
		invoke: (ctx) => ctx.builder.doCmd(['rm','-rf','node_modules','target'])
	},
	"node_modules": {
		prereqs: ["package.json"],
		invoke: (ctx) => ctx.builder.npm(["install"]),
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
		isDirectory: true,
	},
	"demos/RandomMazes.html": {
		prereqs: ["demos/Maze1.php","target/game21libs.amd.es5.js"],
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
		prereqs: ["target/cjs", "target/game21libs.amd.es5.js"]
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
					prereqs: ["target/game21libs.amd.es5.js", "demos/lib.php"],
					invoke: (ctx) => {
						return doCmd("php "+ctx.prereqNames[0]+" > "+ctx.targetName);
					}
				}
			}
		}
		return generatedTargets;
	});
}

// If build.js has changed, assume everything else is out of date!
builder.globalPrereqs = ['build.js', 'src/build/js/Builder.js'];

builder.processCommandLineAndExit(process.argv.slice(2));
