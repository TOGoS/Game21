"use strict";

const child_process = require('child_process');
const fs = require('fs');

/**
 * Escape program arguments to represent as a command
 * that could be run at the shell.
 * For displaying to humans.
 * Don't actually run at the shell because escaping is probably imperfect.
 */
function argsToShellCommand( args ) {
	if( typeof args === 'string' ) return args;
	let escaped = [];
	for( let i in args ) {
		let arg = args[i];
		if( arg.match(/^[a-zA-Z0-9\/\.\+_\-]+$/) ) escaped.push(arg);
		else escaped.push( '"'+arg.replace(/["\$\\]/g,'\\$&')+'"');
	}
	return escaped.join(' ');
}

function readDir( dir ) {
	return new Promise( (resolve,reject) => {
		fs.readdir( dir, (err,files) => {
			if( err ) return reject(err);
			return resolve(files);
		});
	});
}

function mtime( fileOrDir ) {
	return new Promise( (resolve,reject) => {
		fs.stat( fileOrDir, (err, stats) => {
			if( err ) {
				if( err.code == 'ENOENT' ) resolve(undefined);
				else reject(new Error("Failed to stat "+fileOrDir+": "+JSON.stringify(err)));
				return;
			}
			if( stats.isFile() ) {
				resolve( stats.mtime );
			} else if( stats.isDirectory() ) {
				resolve(readDir(fileOrDir).then( (files) => {
					let mtimePromz = [];
					for( let f in files ) {
						let fullPath = fileOrDir+"/"+files[f];
						mtimePromz.push(mtime(fullPath));
					}
					return Promise.all(mtimePromz).then( (mtimes) => {
						let maxMtime = stats.mtime;
						for( let m in mtimes ) {
							if( mtimes[m] != undefined && mtimes[m] > maxMtime ) { 
								maxMtime = mtimes[m];
							}
						}
						return maxMtime;
					});
				}));
			} else {
				reject(new Error(fileOrDir+" is neither a regular file or a directory!"));
			}
		});
	}); 
}

function touch( fileOrDir ) {
	console.log("Touching "+fileOrDir);
	let curTime = Date.now()/1000;
	return new Promise( (resolve,reject) => {
		fs.utimes(fileOrDir, curTime, curTime, (err) => {
			if( err ) return reject(err);
			else resolve();
		})
	});
}

function processCmd( args ) {
	if( typeof args === 'string' ) {
		return figureShellCommand().then( (prefix) => {
			return concat(prefix, [args]);
		});
	} else {
		return Promise.resolve(args);
	}
}

function doCmd( args ) {
	return processCmd(args).then( (args) => {
		let argStr = argsToShellCommand(args);
		console.log("+ "+argStr);
		return new Promise( (resolve,reject) => {
			let cproc;
			if( typeof args === 'string' ) {
				cproc = child_process.spawn( args, [], {
					shell: true,
					stdio: 'inherit' // For now!
				} );
			} else {
				cproc = child_process.spawn( args[0], args.slice(1), {
					stdio: 'inherit' // For now!
				} );
			}
			cproc.on('error', reject);
			cproc.on('close', (exitCode) => {
				if( exitCode == 0 ) resolve();
				else reject(new Error("Process exited with code "+exitCode+": "+argStr));
			});
		});
	});
}

// To support pre-...syntax node
function append(arr1, arr2) {
	for( let i=0; i<arr2.length; ++i ) arr1.push(arr2[i]);
	return arr1;
}

function concat(arr1, arr2) {
	return append(append([], arr1), arr2);
}

function _getShellCommand(attempts, start) {
	if( start >= attempts.length ) return Promise.reject("Couldn't figure out how to run shell!");
	let shellCommand = concat(attempts[0], ['exit 0']);
	return doCmd(shellCommand).then( () => {
		return attempts[0];
	}, (err) => {
		console.warn("Yarr, "+argsToShellCommand(shellCommand)+" didn't work; will try something else...")
		return _getShellCommand(attempts, start+1);
	})
}

let shellCommandPromise = undefined;
function figureShellCommand() {
	if( shellCommandPromise ) return shellCommandPromise;
	
	let attempts = [
		['sh', '-c'],
		['cmd.exe', '/c']
	];
	
	return shellCommandPromise = _getShellCommand(attempts, 0);
}

function _getNpmCommand(attempts, start) {
	if( start >= attempts.length ) return Promise.reject("Couldn't figure out how to run npm!");
	let npmVCommand = concat(attempts[0], ['-v']);
	return doCmd(npmVCommand).then( () => {
		return attempts[0];
	}, (err) => {
		console.warn("Yarr, "+argsToShellCommand(npmVCommand)+" didn't work; will try something else...")
		return _getNpmCommand(attempts, start+1);
	})
}

let npmCommandPromise = undefined;
function figureNpmCommand() {
	if( npmCommandPromise ) return npmCommandPromise;
	
	let attempts = [
		['npm'],
		["node", "C:/apps/nodejs/node_modules/npm/bin/npm-cli.js"]
	];
	
	return npmCommandPromise = _getNpmCommand(attempts, 0);
}

function npm( args ) {
	return figureNpmCommand().then( (npmCmd) => doCmd(concat(npmCmd, args)) );
}

function tsc( args ) {
	return doCmd(concat(["node","node_modules/typescript/bin/tsc"], args));
}

const targets = {
	"default": {
		prereqs: ["js-libs"]
	},
	"sortaclean": {
		invoke: () => doCmd(['rm','-rf','node_modules'])
	},
	"clean": {
		invoke: () => doCmd(['rm','-rf','node_modules','target'])
	},
	"node_modules": {
		prereqs: ["package.json"],
		invoke: () => npm(["install"]),
		isDirectory: true,
	},
	"target/cjs": {
		prereqs: ["src", "node_modules"],
		invoke: (ctx) => tsc(["-p","src/main/ts/game21libs.cjs.es5.tsconfig.json","--outDir",ctx.targetName]),
		isDirectory: true,
	},
	"target/game21libs.amd.es5.js": {
		prereqs: ["src", "node_modules"],
		invoke: (ctx) => tsc(["-p","src/main/ts/game21libs.amd.es5.tsconfig.json","--outFile",ctx.targetName]),
		isDirectory: true,
	},
	"demos/RandomMazes.html": {
		prereqs: ["demos/Maze1.php","target/game21libs.amd.es5.js"],
		invoke: (ctx) => doCmd("php demos/Maze1.php tabSwitchesMode=false --inline-resources > "+ctx.targetName)
	},
	"run-unit-tests": {
		isFile: false,
		prereqs: ["target/cjs"],
		invoke: (ctx) => doCmd("find target/cjs -name \"*Test.js\" | xargs -n 1 node")
	},
	"run-unit-tests-verbosely": {
		isFile: false,
		prereqs: ["target/cjs"],
		invoke: (ctx) => doCmd("find target/cjs -name \"*Test.js\" | xargs -n 1 -I\"{}\" node \"{}\" -v")
	},
	"run-router": {
		isFile: false,
		prereqs: ["target/cjs"],
		invoke: (ctx) => doCmd("node target/cjs/togos-game21/Router.js"),
	},
	"js-libs": {
		isFile: false,
		prereqs: ["target/cjs", "target/game21libs.amd.es5.js"]
	}
}

function fetchGeneratedTargets() {
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

let allTargetsPromise = undefined;
function fetchAllTargets() {
	if( allTargetsPromise ) return allTargetsPromise;
	
	const allTargets = {};
	for( let n in targets ) allTargets[n] = targets[n];
	return allTargetsPromise = fetchGeneratedTargets().then( (generatedTargets) => {
		for( let n in generatedTargets ) allTargets[n] = generatedTargets[n];
		return allTargets;
	});
}

function fetchTarget( targetName ) {
	return fetchAllTargets().then( (targets) => targets[targetName] );
}

function toSet( arr, into ) {
	if( into == undefined ) into = {};
	for( let x in arr ) into[arr[x]] = arr[x];
	return into;
}

function getTargetPrereqSet( target ) {
	let set = {}
	if( target.prereqs ) toSet(target.prereqs, set);
	if( target.getPrereqs ) toSet(target.getPrereqs(), set);
	set["build.js"] = "build.js";
	return set;
}

function buildTarget( target, targetName, stackTrace ) {
	let targetMtimePromise = mtime(targetName);
	let prereqNames = target.prereqs || []; // TODO: should use the same logic as 
	let prereqSet = getTargetPrereqSet(target);
	let prereqStackTrace = stackTrace.concat( targetName )
	let latestPrereqMtime = undefined;
	let prereqAndMtimePromz = [];
	for( let prereq in prereqSet ) {
		prereqAndMtimePromz.push(build( prereq, prereqStackTrace ).then( () => {
			return mtime(prereq).then( (mt) => [prereq, mt] );
		}));
	}
	
	return targetMtimePromise.then( (targetMtime) => {
		return Promise.all(prereqAndMtimePromz).then( (prereqsAndMtimes) => {
			let needRebuild;
			if( targetMtime == undefined ) {
				console.log("Mtime of "+targetName+" is undefined; need rebuild!");
				needRebuild = true;
			} else {
				needRebuild = false;
				for( let m in prereqsAndMtimes ) {
					let prereqAndMtime = prereqsAndMtimes[m];
					let prereqName = prereqAndMtime[0];
					let prereqMtime = prereqAndMtime[1];
					if( prereqMtime == undefined || targetMtime == undefined || prereqMtime > targetMtime ) {
						console.log(prereqName+" is newer than "+targetName+"; need to rebuild ("+prereqMtime+" > "+targetMtime+")");
						needRebuild = true;
					} else {
						console.log(prereqName+" not newer than "+targetName+" ("+prereqName+" !> "+targetMtime+")");
					}
				}
			}
			if( needRebuild ) {
				console.log("Building "+targetName+"...");
				if( target.invoke ) {
					let prom = target.invoke({
						prereqNames,
						targetName,
					});
					if( target.isDirectory ) prom = prom.then( () => touch(targetName) );
					return prom;
				} else {
					console.log(targetName+" has no build rule; assuming up-to-date");
				}
			} else {
				console.log(targetName+" is already up-to-date");
				return Promise.resolve();
			}
		});
	});
}

let buildPromises = {};

function build( targetName, stackTrace ) {
	if( buildPromises[targetName] ) return buildPromises[targetName];
	
	return buildPromises[targetName] = fetchTarget(targetName).then( (targ) => {
		if( targ == null ) {
			return new Promise( (resolve,reject) => {
				fs.stat(targetName, (err,stats) => {
					if( err ) {
						reject(targetName+" does not exist and I don't know how to build it.");
					} else {
						console.log(targetName+" exists but has no build rule; assuming up-to-date");
						resolve();
					}
				});
			});
		} else {
			return buildTarget(targ, targetName, stackTrace);
		}
	});
}

let buildList = [];
let operation = 'build';
for( let i=2; i<process.argv.length; ++i ) {
	let arg = process.argv[i];
	if( arg == '--list-targets' ) operation = 'list-targets';
	else {
		buildList.push(arg);
	}
}

if( operation == 'list-targets' ) {
	fetchAllTargets().then( (targets) => {
		for( let n in targets ) console.log(n);
	});
} else if( operation == 'build' ) {
	if( buildList.length == 0 ) buildList.push('default');
	let buildProms = [];
	for( let i in buildList ) {
		buildProms.push(build(buildList[i], ["argv["+i+"]"]));
	}
	Promise.all(buildProms).then( () => {
		console.log("Build completed");
	}, (err) => {
		console.error("Error!", err.message, err.stack);
		console.error("Build failed!");
		process.exit(1);
	});
}
