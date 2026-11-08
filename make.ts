#!/usr/bin/env deno -A

import Builder, { BuildContext, BuildRule } from 'https://deno.land/x/tdbuilder@0.5.19/Builder.ts';

type FilePath = string;

const node = "node";

const RESOLVED_PROMISE = Promise.resolve();

type Command = {
	argv: string[]
}

function quotedArgv(argv: string[]): string {
	return argv.map(arg => {
		if (/^[a-zA-Z0-9_\+\-\.\/]+$/.test(arg)) {
			return arg;
		} else {
			return `"${
				arg
					.replaceAll('\\', '\\\\')
					.replaceAll('"', '\\"')
			}"`;
		}
	}).join(' ');
}

async function run(cmd: Command): Promise<void> {
	if (cmd.argv.length === 0) {
		throw new Error("Empty command");
	}

	if (cmd.argv[0] === "x:MkDirs") {
		return Promise.all(cmd.argv.slice(1).map(p => mkdir(p))).then(() => RESOLVED_PROMISE);
	}

	console.log(`Spawning: ${quotedArgv(cmd.argv)}`);

	// On Windows, we need to use cmd /c to run executables that are .bat/.cmd files
	const isWindows = Deno.build.os === "windows";
	let dcmd: Deno.Command;
	
	if (isWindows && (cmd.argv[0] === "npm" || cmd.argv[0] === "php")) {
		// Use cmd /c for Windows batch executables
		// TODO: Don't go through cmd; just run things directly.
		// This might mean we need to find exact paths/extensions.
		dcmd = new Deno.Command("cmd", { args: ["/c", ...cmd.argv] });
	} else {
		dcmd = new Deno.Command(cmd.argv[0], { args: cmd.argv.slice(1) });
	}
	
	const proc = dcmd.spawn();
	const status = await proc.status;
	if (!status.success) {
		throw new Error(`${cmd.argv[0]} failed with code ${status.code}`);
	}
}

async function runCapture(cmd: Command): Promise<string> {
	if (cmd.argv.length === 0) {
		throw new Error("Empty command");
	}

	console.log(`Spawning: ${quotedArgv(cmd.argv)}`);

	const dcmd = new Deno.Command(cmd.argv[0], { args: cmd.argv.slice(1) });
	const proc = dcmd.spawn();
	const textDecoder = new TextDecoder();
	let output = "";
	
	for await (const chunk of proc.stdout) {
		output += textDecoder.decode(chunk);
	}
	
	const status = await proc.status;
	if (!status.success) {
		throw new Error(`${cmd.argv[0]} failed with code ${status.code}`);
	}
	
	return output;
}

const dirsMade = new Map<FilePath, Promise<void>>();
function mkdir(dir: FilePath): Promise<void> {
	let prom = dirsMade.get(dir);
	if (prom === null || prom === undefined) {
		prom = Deno.mkdir(dir, { recursive: true });
		dirsMade.set(dir, prom);
	}
	return prom;
}

async function unlink(path: FilePath) {
	try {
		await Deno.remove(path);
	} catch (e) {
		if ((e as Error).name === 'NotFound') return;
		throw e;
	}
}

function fileExists(path: FilePath): Promise<boolean> {
	return Deno.stat(path).then(_stat => true, (err: Error) => {
		if (err.name === "NotFound") {
			return false;
		} else {
			return Promise.reject(err);
		}
	});
}

function basename(path: FilePath) {
	const lastSlashIndex = path.lastIndexOf('/');
	const lastBackslashIndex = path.lastIndexOf('\\');
	const lastIndex = Math.max(lastSlashIndex, lastBackslashIndex);
	return lastIndex < 0 ? path : path.substring(lastIndex + 1);
}

/**
 * Make sure the parent directory exists
 * and that the named file does *not* already exist.
 */
async function mkRoom(path: FilePath) {
	const lastSlashIndex = path.lastIndexOf('/');
	const lastBackslashIndex = path.lastIndexOf('\\');
	const lastIndex = Math.max(lastSlashIndex, lastBackslashIndex);
	if (lastIndex > 0) {
		await mkdir(path.substring(0, lastIndex));
	}
	await unlink(path);
}

/** Build rule that is an alias for a set of targets */
function brAlias(targetNames: Iterable<string> | AsyncIterable<string>): BuildRule {
	return {
		targetType: "phony",
		prereqs: targetNames
	};
}

// Helper to find files matching patterns
async function findFiles(baseDir: string, pattern: RegExp): Promise<string[]> {
	if (!await fileExists(baseDir)) {
		return [];
	}
	const files: string[] = [];
	try {
		for await (const entry of Deno.readDir(baseDir)) {
			if (entry.isFile && pattern.test(entry.name)) {
				files.push(`${baseDir}/${entry.name}`);
			}
		}
	} catch (_e) {
		// Directory might not exist yet
	}
	return files;
}

async function findTsFiles(baseDir: string): Promise<string[]> {
	const files: string[] = [];
	async function walk(dir: string) {
		try {
			for await (const entry of Deno.readDir(dir)) {
				const fullPath = `${dir}/${entry.name}`;
				if (entry.isFile && entry.name.endsWith('.ts')) {
					files.push(fullPath);
				} else if (entry.isDirectory && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
					await walk(fullPath);
				}
			}
		} catch (_e) {
			// Ignore read errors
		}
	}
	if (await fileExists(baseDir)) {
		await walk(baseDir);
	}
	return files;
}

// Build the builder configuration
const builder = new Builder({
	rules: {
		// Install npm dependencies
		"node_modules": {
			prereqs: ["package.json"],
			invoke: async (ctx: BuildContext) => {
				await run({ argv: ["npm", "install"] });
				// Touch to mark completion
				await Deno.stat(ctx.targetName).catch(() => {
					return Deno.mkdir(ctx.targetName);
				});
			}
		},

		// Copy tshash library (TypeScript hash library from npm)
		"src/main/ts/tshash": {
			prereqs: ["node_modules"],
			invoke: async (ctx: BuildContext) => {
				try {
					await Deno.remove(ctx.targetName, { recursive: true });
				} catch (_e) {
					// Ignore if it doesn't exist
				}
				// Copy directory recursively using deno
				const src = "node_modules/tshash/src/main/ts/tshash";
				if (await fileExists(src)) {
					// Use deno's file copy functionality
					const stat = await Deno.stat(src);
					if (stat.isDirectory) {
						// Create directory structure
						await mkdir(ctx.targetName);
						for await (const entry of Deno.readDir(src)) {
							const srcPath = `${src}/${entry.name}`;
							const dstPath = `${ctx.targetName}/${entry.name}`;
							if (entry.isFile) {
								const content = await Deno.readFile(srcPath);
								await Deno.writeFile(dstPath, content);
							}
						}
					}
				}
			}
		},

		// Compile TypeScript library targets (AMD ES5)
		"target/game21libs.amd.es5.js": {
			prereqs: [
				"src/main/ts/game21libs.amd.es5.tsconfig.json",
				"node_modules",
				"src/main/ts/tshash"
			],
			invoke: async (ctx: BuildContext) => {
				await mkRoom(ctx.targetName);
				await run({
					argv: [node, "node_modules/typescript/bin/tsc", "-p", ctx.prereqNames[0], "--outFile", ctx.targetName]
				});
			}
		},

		// Compile TypeScript library targets (CommonJS ES5)
		"target/cjs": {
			prereqs: [
				"src/main/ts/game21libs.cjs.es5.tsconfig.json",
				"node_modules",
				"src/main/ts/tshash"
			],
			invoke: async (ctx: BuildContext) => {
				await mkdir(ctx.targetName);
				await run({
					argv: [node, "node_modules/typescript/bin/tsc", "-p", ctx.prereqNames[0], "--outDir", ctx.targetName]
				});
			}
		},

		// Demo file generation (PHP-based) - Maze1.html
		"demos/Maze1.html": {
			prereqs: [
				"demos/Maze1.php",
				"target/game21libs.amd.es5.js",
				"mazes.lst"
			],
			invoke: async (ctx: BuildContext) => {
				await mkRoom(ctx.targetName);
				try {
					const mazesList = await Deno.readTextFile("mazes.lst");
					const lastMazeLine = mazesList.trim().split('\n').pop() || "";
					const phpCmd = new Deno.Command("php", {
						args: [
							"demos/Maze1.php",
							`saveGameRef=${lastMazeLine}`,
							"--inline-resources"
						],
						stdout: "piped"
					});
					const proc = phpCmd.spawn();
					using file = await Deno.open(ctx.targetName, { write: true, createNew: true });
					await proc.stdout?.pipeTo(file.writable);
					const status = await proc.status;
					if (!status.success) {
						throw new Error(`PHP failed with code ${status.code}`);
					}
				} catch (e) {
					console.error(`Error generating ${ctx.targetName}:`, e);
					throw e;
				}
			}
		},

		// RandomMazes.html
		"demos/RandomMazes.html": {
			prereqs: [
				"demos/Maze1.php",
				"target/game21libs.amd.es5.js"
			],
			invoke: async (ctx: BuildContext) => {
				await mkRoom(ctx.targetName);
				try {
					const phpCmd = new Deno.Command("php", {
						args: [
							"demos/Maze1.php",
							"tabSwitchesMode=false",
							"--inline-resources"
						],
						stdout: "piped"
					});
					const proc = phpCmd.spawn();
					using file = await Deno.open(ctx.targetName, { write: true, createNew: true });
					await proc.stdout?.pipeTo(file.writable);
					const status = await proc.status;
					if (!status.success) {
						throw new Error(`PHP failed with code ${status.code}`);
					}
				} catch (e) {
					console.error(`Error generating ${ctx.targetName}:`, e);
					throw e;
				}
			}
		},

		// RandomMazesDoc.html
		"demos/RandomMazesDoc.html": {
			prereqs: [
				"demos/Maze1.php",
				"target/game21libs.amd.es5.js"
			],
			invoke: async (ctx: BuildContext) => {
				await mkRoom(ctx.targetName);
				try {
					const phpCmd = new Deno.Command("php", {
						args: [
							"demos/Maze1.php",
							"tabSwitchesMode=false",
							"includeFakeContent=true",
							"--inline-resources"
						],
						stdout: "piped"
					});
					const proc = phpCmd.spawn();
					using file = await Deno.open(ctx.targetName, { write: true, createNew: true });
					await proc.stdout?.pipeTo(file.writable);
					const status = await proc.status;
					if (!status.success) {
						throw new Error(`PHP failed with code ${status.code}`);
					}
				} catch (e) {
					console.error(`Error generating ${ctx.targetName}:`, e);
					throw e;
				}
			}
		},

		// Generic demo rule for other .php files in demos/
		"demos/ShapeDemo.html": {
			prereqs: [
				"demos/ShapeDemo.php",
				"target/game21libs.amd.es5.js"
			],
			invoke: async (ctx: BuildContext) => {
				await mkRoom(ctx.targetName);
				try {
					const phpCmd = new Deno.Command("php", {
						args: [
							"demos/ShapeDemo.php",
							"--inline-resources"
						],
						stdout: "piped"
					});
					const proc = phpCmd.spawn();
					using file = await Deno.open(ctx.targetName, { write: true, createNew: true });
					await proc.stdout?.pipeTo(file.writable);
					const status = await proc.status;
					if (!status.success) {
						throw new Error(`PHP failed with code ${status.code}`);
					}
				} catch (e) {
					console.error(`Error generating ${ctx.targetName}:`, e);
					throw e;
				}
			}
		},

		// Test running
		"test": brAlias(["run-unit-tests"]),
		"run-unit-tests": {
			targetType: "phony",
			prereqs: ["target/cjs"],
			invoke: async (ctx: BuildContext) => {
				// Find all Test.js files and run them
				const testFiles = await findFiles("target/cjs", /Test\.js$/);
				if (testFiles.length === 0) {
					console.log("No test files found");
					return;
				}
				for (const testFile of testFiles) {
					console.log(`Running test: ${testFile}`);
					await run({ argv: [node, testFile] });
				}
			}
		},

		"run-unit-tests-verbosely": {
			targetType: "phony",
			prereqs: ["target/cjs"],
			invoke: async (ctx: BuildContext) => {
				// Find all Test.js files and run them with verbose flag
				const testFiles = await findFiles("target/cjs", /Test\.js$/);
				if (testFiles.length === 0) {
					console.log("No test files found");
					return;
				}
				for (const testFile of testFiles) {
					console.log(`Running test (verbose): ${testFile}`);
					await run({ argv: [node, testFile, "-v"] });
				}
			}
		},

		"run-router": {
			targetType: "phony",
			prereqs: ["target/cjs"],
			invoke: async () => {
				await run({ argv: [node, "target/cjs/togos-game21/Router.js"] });
			}
		},

		// Default target
		"default": brAlias(["js-libs"]),
		"js-libs": brAlias(["target/cjs", "target/game21libs.amd.es5.js"]),

		// Demo alias
		"demos": brAlias([
			"demos/Maze1.html",
			"demos/RandomMazes.html",
			"demos/RandomMazesDoc.html",
			"demos/ShapeDemo.html"
		]),

		// Clean targets
		"sortaclean": {
			targetType: "phony",
			invoke: async () => {
				// Remove generated files and directories
				try {
					await Deno.remove("target", { recursive: true });
				} catch (_e) {
					// Ignore if doesn't exist
				}
				// Remove demo HTML files
				for (const file of ["demos/Maze1.html", "demos/RandomMazes.html", "demos/RandomMazesDoc.html", "demos/ShapeDemo.html"]) {
					await unlink(file);
				}
			}
		},

		"clean": {
			targetType: "phony",
			prereqs: ["sortaclean"],
			invoke: async () => {
				try {
					await Deno.remove("node_modules", { recursive: true });
				} catch (_e) {
					// Ignore
				}
			}
		}
	}
});

if (import.meta.main) {
	Deno.exit(await builder.processCommandLine(Deno.args));
}
