# Game21, a.k.a. 'Game Thing'

Simulation experiments and suchlike.

```node build.js run-unit-tests``` to build and run the unit tests.

```node build.js js-libs``` to build both client (AMD) and server (CJS)-side libraries.

```make``` also works, but is basically an alias for ```node build.js```.

Demo pages are in ```demos/```.
For them to work you'll need PHP (to evaluate the php files) and to have built the client-side libraries.
Some demos may require some servers to be running or something.


## Simulator/simulated separation

The world being simulated is represented as 'dumb' data objects.
Lots of interfaces with all data, no behavior.
Those interfaces should be designed with these principles in mind:

- Try to keep them as declarative as possible;
  Don't think about how it will be simulated;
- Parts of large object trees that are relatively static and have potential to be re-used
  should be referenced by URN instead of directly contained in parent objects.

This decouples the simulated world from the simulation implementation,
and gives a lot more flexibiliy to the simultion implementation.


## XML-style namespaces

Names for top-level classes:

```http://ns.nuke24.net/Game21/FunThing```

Names for subclasses are of the format ```TopLevelClass/SubClass```:

```http://ns.nuke24.net/Game21/FunThing/SpecialFunThing```

Names for specific instances are of the format ```Collection/Item```:

```http://ns.nuke24.net/Game21/FunThings/TheBrownOne```
