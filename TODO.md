## Demos

* Simple maze world with discrete (though possibly in small unit, like 1/8m) movement
* Maze with editor and 'hey hey you win' point
  * GDM to skip re-saving data that it fetched from the datastore in the first place
  * Show something on screen indicating loading/saving's going on
  * Load demo data from packfile to avoid a million GETs
  * Hey hey you win item - touch it and it pops up a "You win" box
* Random maze (entry 21)
  * submit to contest by Oct 30th
  * sound effects
  * vomit chunks
  * keys and switches
  - monsters (maybe just bouncy lightbulbs)
- In-browser ping-handling network
- Ping-handling network simulated on server
- Refactor ShapeSheet to store z, dz/dx, dz/dy instead of corner depths
- Get tile rendering working again
- Isometric world rendering
- Packet truck
- Image with dynamic (via material map overrides) indicator lights?
- Small game with signal wires?
- Simple single-player maze game
- Single-player game with use of IP packets
- Client-server game
- Trains
- Shmoons

## Misc to-do items

Building:
- Automatically remove failed build targets

Unify rendering (update or replace WorldCanvasView)
- Render to canvas immediately
- Render to canvas, waiting for images to load
- Get image immediately or trigger loading
- Get image promise
- Support all image types:
  - RGBA image
  - ShapeSheet
  - ForthProceduralShape
  * DynamicEntityVisual
  * CompoundVisual
  * BitImage

Clean up simulation source files
(they got kind of messy during the recent Maze1SimulationUpdate.ts refactor,
with some definitions duplicated between files).

Work towards network simulation
- Have a button that sends an OSC message through a physical wire
Maze1 simulation incremental refactoring
- Maze1Demo becomes Maze1UI
  - and continue to decouple from simulation
- Partially immutable game states
  - Promise-based so that stuff can be loaded as needed
  - For the sake of clarity, pretend things are immutable for the most part
  - Messaging steps are basically tree rewriting, so should be easier to make purely functional and promise-based
  - Physics step:
    - load all physically active rooms and their neighbors
    - do physics step about the same as currently
  - Occasional cache clear
  - More occasional flushUpdates()
- enqueueStep() { this.currentStatePromise = this.currentStatePromise.then( (currentState) => this.nextState(currentState, ) }

Rendering - try to unify:
- immediate (draw what's available as fast as possible) vs promise-based (e.g. for 'offline' rendering)
- Render to images and blit vs fully ShapeSheet-based rendering

Different random maze generation:
- wave function collapse-generated rooms
- big old simplex noise caves

Maze1:
- Talk command, show talked messages
  - this will allow showing early machine interaction working, as machines
    can speak "You touched me!" and stuff.
* Some way to 'trigger' things; buttons or pressure plates or something
  - keep in mind will want to trigger with item, e.g. key
  - way for objects to 'appear to be usable with an item'
- Draw additional neighbors if no overlap.
  Maybe collect a list, then draw nearest-farthest N,
  skipping ones that would overlap or are outside some bounds.
- Unify client/server view models; in edit mode, just send the room data as-is
  - This way we could ctrl+click TileTree blocks and stuff!
- Keys, other inventory items
- Enemies?
- Background layer! (just draw darker than fg)
- Doorbell to control the door
- Dynamic tile entities?
  - i.e. room entities that are spawned to represent state of existing
    tile tree nodes
    dynamicTileEntities: { [tileTreeRoomEntityId] => { "x,y,z,size" => Entity } }
  - would store e.g. state of network switches and things
  - may be removed when state returns to default

Advanced AI:
- Rare CPUs are offloaded to a Docker container

Networking:
- Use SLAAC to get address
  - explicitly bridge interfaces in Router
  - prefix belongs to bridge rather than to individual links
  - broadcast packets are broadcasted to all links on bridge
- Use DHCP to get address
- Use ethernet as universal packet framing (ethertype)
- Multi-component simulation in browser
  - Maybe grid-based?  To make editing easier.
  - Use game21 renderign system for images!

Conveyor belts:
- Same mechanism (with slight variations) can implement
  - network links
  - pneumatic tubes (taking the role of belts in Factorio)
- onCollide = destroyAll, destroyLater, blockLater
- splitters can select send input to one output or all at once
  (copying only makes sense for signals, not physical objects)
  - collision logic would not apply to signal being copied
- To simplify physics calculation, since items are 'pushed', mergers do not prioritize inputs
  - (assuming 'push'-based physics; pull-based might be interesting, too)
  - but a smart device before the merger could throttle input belts
- belt segments are divided into 'subsegments', which are the 'physical' part
  that are attached to the world
- Could probably build a fun game entirely using the tube system

Graphics:
- Support .obj format natively;
    urn:asdasd eval-obj
  or
    "v 0 0 1 ... " eval-obj
  Can require that string be a literal or URI and compile it to a forth word at compile-time.
- Allow $material-index to be a (x,y,z) -> material index function
  - Origin/transform determined by context when function defined?
    - which would automatically account for object rotation
For tubes:
- Render front, back half of tubes separately
- For translucent surfaces, dither in shapesheet; will be AAd to translucency when rendered.

Idea for simple physics engine:
- quantized.  1/8m or somesuch.  all movement is one 1/8m square at a time.
  no collisions are allowed to occur.
  - Or quantized based on object size, so small objects do smaller steps than large ones?
- objects may be 'wiggled' into holes if their center of gravity is not supported
  (possibly require multiple points to be unsupported before doing this, or results
   could be surprising)

Idea for better continuous physics:
- Move all 'moving' objects in some deterministic order where more massive objects go first
  - some deterministic method for tie-breaking, such as by object position
- collisions are checked all along an object's path, so e.g. bullets hit things
- lighter objects may influence collision detection ('movement for this frame ends here'),
  but do not 'hard-displace' heavier objects
- on collision
  - build list of constraints to be applied to the lighter object
- for each object that has had constraints applied:
  - find minimum change in position that satisfies all constraints
  - adjust position to satisfy all constraints
    - recursively break down object if constraints cannot be met; e.g. the object is being crushed or torn off its tracks
  - adjust velocities
  - other affects on objects (damage, notifications, etc)
- Can this handle complex systems of objects?

ShapeSheet editor:
- Occasional 'soft' save to local storage

ForthProceduralShapes scripts:
- Allow loading from HTTP URLs
- Allow importing definitions from other scripts

For maze game:
- a nicer map editor
- perspective flattening in certain z range (focus -8 to +8 or somesuch)

Density function tracer:
- Quit when exiting bounding rectangle
- Only return 'hole' if value at the last point is more negative than any other encountered

Infrastructure:
- distributed bucket maps
- Better WebSocket demo with packets and IP6Addresses and some options on the page like which URL to connect to
- Router

Fun stuff:
- Visual demo of train running on tracks

- Define standard materials, including
  several for indicator lights with separate materials for each state (off, half-on, on, unspecified)
  8 lights * 4 materials for each = 32 material indexes reserved for lights
  standard index meanings for power, signal, data, us1..us3

- states, animation frames can both apply additional material map (and maybe object rotations?  sure, why not)

- Shader that forces opacity to 0 or 1
- Shader that only applies fog to opaque cells

Possibly outdated but maybe not:
- A 'shape role' assigns specific meaning to shape parts (possibly allowing scaling)
  Shapes can indicate that they are implementing a role
- Try loading an environment map image, blurring it, reading its pixels
* Will need a base32 encoder; maybe npm has one; otherwise port yours again
- TigerTree function
- Load a spritesheet, render tiles for game
- Placeholder text/image in <canvas>
- Reflection using environment map (glassy and metallic reflection)
- Import a pipe shape into the game
- Self-shadowing (not useful for tiles, but fun to play with)
- Serialize all data including preview as PNG
- Deserialize!

## Past Demos

* Shape rendering with lightning
* Generate a bunch of different blocks from a shape
* ShapeSheet editor (http://www.nuke24.net/plog/11.html)
  * Separate out ForthProceduralShape
  * Save script, show URN
  * Load script
  * Draw polygons
  * Load button/dialog
  * Drag-to-rotate
  * Change URL when saving/loading
  * Fix polygon and sphere rendering (avoid generating edge artifacts)
  * Show log in message area
* Visual demo of multi-room maze

## Done!

* s/Material/SurfaceMaterial/
* Ping he.net from browser and receive pong
* Centralize address configuration in .env
* Allocate IP address for each browser connected
* Have 2 browsers ping each other
* Browser-based ping w/ SLAAC
* Goofy conveyor belt demo
* Convert OBJ (from FreeCAD) to procedural shape script
  "Can only contain triangulated meshes." which should make my job easy.
  -- http://www.freecadweb.org/wiki/index.php?title=Manual:Import_and_export_to_other_filetypes
* Delete MiniConsole, rename ui/MultiConsole to MultiLogger
Boring code stuff:
* Base32, SHA-1
* noImplicitAny: true
* noImplicitReturns: true
* strictNullChecks: true
Build system:
* Build a single alllibs.amd.es5.js so lib.php doesn't have to know them all
* Have .tsconfig.json files inherit from a common one
Maze1:
* Decentish quantized physics (overlaps not allowed)
* Platform physics (good enough for now)
  - Silly but kinda works solution for platforms:
    - move entities 'moving away' (from the centers of their rooms) first
    - glitches at room boundaries (so avoid platforms crossing those!)
* Create, connect new rooms interactively
* Make jumping less unreasonable
* Make jumping from on top of non-infinite-mass things workd
* Render TileTrees properly for tile palette UI
* Show save game in console
* Save savegames to server
* requestAnimationFrame to render scene
* Generate some kind of packfile (JSON of URN => data as string)
* Bind key listeners to game interface element instead of window
* Escape or enter should close 'you win!' window
* Win dialog should be less big; buttons should be larger and centered
* Guess to add '#' on the end of save game refs that are missing it.
* Number keys to select tile palette.
* Update loading status while generating
* extra items scattered around (apples, sandwiches, trophies)
* Ability to place non-block entities (can /give them to yourself, at least)
* Friction
* Control+click is broken!!  plz fix.  maybe on master branch
* Dead player should drop any maze1 items
* Cheaty sound effects (physics directly messages UI)
Random maze generation:
* 8x8 rooms
* generate maze graph
* translate graph nodes to rooms
* print out solution (left, right, down, etc)
* colored blocks to mark where doors were
* blocks platforms under items
* keys, locked doors (cheated on implementation)
* hardness/size setting
* mandatory loops
* more decorations
* Fix: player can occasionally start stuck in a wall
* cave rooms;
Maze1 simulation, post-random-maze-contest:
* Move simulator + physics engine to own file
* Vision data forwarded through player
* Figure out why vision refactoring
  (c4791e7db15ba1c8196d9a87c90a0f623ef185fc..84da1e0da789f0565edc030df7a61ea38ca5ce03)
  made everything super slow (FPS on Harold down from 30-32 to 9-15).
  - Chrome's profiler to the rescue! (srsly this made it obvious right away)
  - fullyCacheTileEntityPalette was taking up a lot of time
    since each simulation step tries to fully cache all the rooms its going to work on ahead of time.
  - Made GameDataManager#fillyCacheRoom remember when rooms are already fully cached.
  - This could be further optimized, but that made a huge difference.
  Lesson: Use the profiler.
* Button send a 1-bit message through a wire
