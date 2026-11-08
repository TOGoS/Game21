# Game21, a.k.a. 'Game Thing'

Simulation experiments and suchlike.

## Building

The build system has been converted from GNU Make to **TDBuilder** (Deno-based).

### Building with Deno

```bash
# Install dependencies and build all libraries
deno run -A make.ts

# Run unit tests
deno run -A make.ts test

# Build specific target
deno run -A make.ts target/cjs

# List all available targets
deno run -A make.ts --list-targets

# Clean build artifacts
deno run -A make.ts sortaclean
```

### Legacy Make Commands (still available)

If you prefer the old Makefile:
```make run-unit-tests``` to build and run the unit tests.

```make js-libs``` to build both client (AMD) and server (CJS)-side libraries.

Demo pages are in ```demos/```.
For them to work you'll need PHP (to evaluate the php files) and to have built the client-side libraries.
Some demos may require some servers to be running or something.

## XML-style namespaces

Names for top-level classes:

```http://ns.nuke24.net/Game21/FunThing```

Names for subclasses are of the format ```TopLevelClass/SubClass```:

```http://ns.nuke24.net/Game21/FunThing/SpecialFunThing```

Names for specific instances are of the format ```Collection/Item```:

```http://ns.nuke24.net/Game21/FunThings/TheBrownOne```
