# Game21, a.k.a. 'Game Thing'

Simulation experiments and suchlike.

```node build.js run-unit-tests``` to build and run the unit tests.

```node build.js js-libs``` to build both client (AMD) and server (CJS)-side libraries.

```make``` also works, but is basically an alias for ```node build.js```.

Demo pages are in ```demos/```.
For them to work you'll need PHP (to evaluate the php files) and to have built the client-side libraries.
Some demos may require some servers to be running or something.

I sometimes write down [ideas for how to do things](thoughts/).
Not all of these become reality.
Some of them end up on [TOGoS's project log](http://www.nuke24.net/plog/).

I'm going to try to keep the real conceptual stuff in thoughts/
and documentation on practices I'm actually following here in README.


## Coordinate system

Throughout this codebase I assume a right-handed coordinate system
where +X = right, +Y = down, and +Z = forward (into the screen).

Distance units are assumed to be 'meters' unless specified otherwise.
When dealing with raster data, the size of a pixel must be explicitly provided
(usually in terms of 'pixels per meter', which is what 'resolution' refers to)
to convert to physical distance units.



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

Used to identify intrinsic concepts.

Probably should document allocated names somewhere.

General guidelines:

Names for top-level classes:

```http://ns.nuke24.net/Game21/FunThing```

Names for subclasses are of the format ```TopLevelClass/SubClass```:

```http://ns.nuke24.net/Game21/FunThing/SpecialFunThing```

Names for specific instances are of the format ```Collection/Item```:

```http://ns.nuke24.net/Game21/FunThings/TheBrownOne```


## Router

There's a router program included for bridging real and simulated IP networks.

IPv6 is assumed, because nobody wants to deal with trying to allocate
IPv4 addresses for a bunch of simulated objects.

### Router deployment

- Check out Game21 project into some directory somewhere
- Edit .env to set network addresses that will be routed to your machine

As root:

- Install node, npm, make, tun2udp
- ```sysctl net.ipv6.conf.all.forwarding=1```
- Also edit ```/etc/sysctl.conf``` to change that setting permanently.
- Create a startup script (maybe just add to ```/etc/rc.local```:
  ```
  cd /path/to/Game21
  ./runtun >tun2udp.log 2>&1 &
  echo "$!" >tun2udp.pid
  ```
  - ```runtun``` will run tun2udp and set up routes as needed
- Also add a startup script to start the router in non-interactive mode, I guess.
  - Which doesn't yet exist.
