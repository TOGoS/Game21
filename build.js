"use strict";

const child_process = require('child_process');
const fs = require('fs');

function argsToShellCommand( args ) {
	return args.join(' ');
}

function mtime( fileOrDir ) {
	return new Promise( (resolve,reject) => {
		fs.stat( fileOrDir, (err, stats) => {
			if( err ) {
				if( err.code == 'ENOENT' ) return resolve(undefined);
				return reject(new Error("Failed to stat "+fileOrDir+": "+JSON.stringify(err)));
			}
			if( stats.isFile() ) {
				return resolve( stats.mtime );
			} else if( stats.isDirectory() ) {
				fs.readdir( fileOrDir, (err, files) => {
					if( err ) {
						return reject("Failed to readdir("+fileOrDir+")");
					}
					let mtimePromz = [];
					for( let f in files ) {
						let fullPath = fileOrDir+"/"+files[f];
						mtimePromz.push(mtime(fullPath));
					}
					resolve(Promise.all(mtimePromz).then( (mtimes) => {
						let maxMtime = stats.mtime;
						for( let m in mtimes ) {
							if( mtimes[m] != undefined && mtimes[m] > maxMtime ) { 
								maxMtime = mtimes[m];
							}
						}
						return maxMtime;
					}));
				})
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

function doCmd( args ) {
	console.log("+ "+argsToShellCommand(args));
	return new Promise( (resolve,reject) => {
		const cproc = child_process.spawn( args[0], args.slice(1), {
			stdio: 'inherit' // For now!
		} );
		cproc.on('close', (exitCode) => {
			if( exitCode == 0 ) resolve();
			else reject(new Error("Process exited with code "+exitCode+": "+args.join(' ')));
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
	
	return _getNpmCommand(attempts, 0);
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
		prereqs: ["sortaclean"],
		invoke: () => Promise.resolve()
	},
	"node_modules": {
		prereqs: ["package.json"],
		invoke: () => npm(["install"]),
		isDirectory: true,
	},
	"target/cjs": {
		prereqs: ["src", "node_modules"],
		invoke: () => tsc(["-p","src/main/ts/game21libs.cjs.es5.tsconfig.json","--outDir","target/cjs"]),
		isDirectory: true,
	},
	"js-libs": {
		isFile: false,
		prereqs: ["target/cjs", "target/game21libs.amd.es5.js"]
	},
	"foo.txt": {
		prereqs: ["bar.txt"],
		invoke: () => doCmd(["cp","bar.txt","foo.txt"])
	}
}

function getTarget( targetName ) {
	return targets[targetName];
}

function toSet( arr, into ) {
	if( into == undefined ) into = {};
	for( let x in arr ) into[arr[x]] = arr[x];
	return into;
}

function getTargetPrereqSet( target ) {
	let set = {"build.js": "build.js"};
	if( target.prereqs ) toSet(target.prereqs, set);
	if( target.getPrereqs ) toSet(target.getPrereqs(), set);
	return set;
}

function buildTarget( target, targetName, stackTrace ) {
	let targetMtimePromise = mtime(targetName);
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
			console.log("Oh hey look "+targetName+" has "+prereqsAndMtimes.length+" prereqs");
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
				if( target.invoke ) {
					let prom = target.invoke();
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
	
	console.log("Building "+targetName+"...");
	let targ = getTarget(targetName);
	if( targ == null ) {
		return new Promise( (resolve,reject) => {
			fs.stat(targetName, (err,stats) => {
				if( err ) reject(targetName+" does not exist and I don't know how to build it.");
				else {
					console.log(targetName+" exists but has no build rule; assuming up-to-date");
					resolve();
				}
			});
		});
	}
	return buildPromises[targetName] = buildTarget(targ, targetName, stackTrace);
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
	for( let t in targets ) console.log(t);
} else if( operation == 'build' ) {
	if( buildList.length == 0 ) buildList.push('default');
	let buildProms = [];
	for( let i in buildList ) {
		buildProms.push(build(buildList[i], ["argv["+i+"]"]));
	}
	Promise.all(buildProms).catch( (err) => {
		console.error("Error!", err.message, err.stack);
		console.error("Build failed!");
		process.exit(1);
	});
}
