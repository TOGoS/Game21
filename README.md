# Game21, a.k.a. 'Game Thing'

Simulation experiments and suchlike.

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
