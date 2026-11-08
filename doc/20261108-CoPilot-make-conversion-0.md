# Makefile to make.ts Conversion

Game21's build system has been converted from a traditional GNU Makefile to a **TDBuilder-based make.ts** script.

## Overview

- **Old system**: `Makefile` - Traditional GNU Make syntax
- **New system**: `make.ts` - TypeScript build script using [TDBuilder](https://deno.land/x/tdbuilder)
- **Execution**: `deno run -A make.ts [targets...]`

## Key Targets

### Primary Build Targets
- `default` / `js-libs` - Build all JavaScript libraries (CommonJS and AMD ES5)
- `target/cjs` - Compile CommonJS ES5 modules to `target/cjs/`
- `target/game21libs.amd.es5.js` - Compile AMD ES5 module bundle
- `node_modules` - Install npm dependencies

### Testing
- `test` / `run-unit-tests` - Run all unit tests found in `target/cjs/**/*Test.js`
- `run-unit-tests-verbosely` - Run tests with verbose output
- `run-router` - Run the Router application

### Demo Generation
- `demos` - Generate all demo HTML files
- `demos/Maze1.html` - Generate Maze1 demo
- `demos/RandomMazes.html` - Generate RandomMazes demo
- `demos/RandomMazesDoc.html` - Generate RandomMazes with documentation
- `demos/ShapeDemo.html` - Generate ShapeDemo

### Maintenance
- `sortaclean` - Remove generated files (target/, demo HTMLs)
- `clean` - Full clean (includes node_modules/)

## Advantages of TDBuilder

1. **Type-safe**: Written in TypeScript with full type checking
2. **Parallel builds**: Can run build tasks in parallel (use `--parallel`)
3. **Cross-platform**: Deno handles cross-platform differences automatically
4. **Debuggable**: Can use Deno's debugging capabilities
5. **Composable**: Build rules are functions that can be composed and reused

## Usage Examples

```bash
# Build default targets
deno run -A make.ts

# Build specific target
deno run -A make.ts target/cjs

# Run tests
deno run -A make.ts test

# List all available targets
deno run -A make.ts --list-targets

# Clean build artifacts
deno run -A make.ts sortaclean

# Full clean (including node_modules)
deno run -A make.ts clean

# Build in parallel
deno run -A make.ts --parallel js-libs test
```

## Build Rule Structure

Each build rule includes:
- **prereqs**: Prerequisite targets that must be built first
- **invoke**: Async function that performs the build step
- **targetType**: Can be "phony" (always runs) or file-based

Example:
```typescript
"target/cjs": {
    prereqs: [
        "src/main/ts/game21libs.cjs.es5.tsconfig.json",
        "node_modules",
        "src/main/ts/tshash"
    ],
    invoke: async (ctx: BuildContext) => {
        await mkdir(ctx.targetName);
        await run({
            argv: [tsc, "-p", ctx.prereqNames[0], "--outDir", ctx.targetName]
        });
    }
}
```

## Next Steps for Deno Compilation

Now that the build system is updated, the next phase is to:
1. Update TypeScript files for Deno compatibility
2. Update import statements (remove relative requires, use standard module imports)
3. Test compilation with Deno's TypeScript compiler
4. Add Deno-specific type definitions where needed

## Comparison with Original Makefile

| Feature | Makefile | make.ts |
|---------|----------|---------|
| Language | Make | TypeScript (via Deno) |
| Parallelization | Implicit with `-j` | Explicit with `--parallel` |
| Type Safety | None | Full TypeScript support |
| Cross-platform | Requires GNU Make | Native cross-platform |
| PHP Support | Direct | Still supported via Deno.Command |
| Dependencies | Shell `find` commands | Deno async file APIs |
