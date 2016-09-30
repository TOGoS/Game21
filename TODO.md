## Demos

* Simple maze world with discrete (though possibly in small unit, like 1/8m) movement
- Make maze game with 'hey hey you win' point
- Packet truck
- Image with dynamic (via material map overrides) indicator lights?
- Small game with signal wires?
- Simple single-player maze game
- Single-player game with use of IP packets
- Client-server game
- Trains
- Shmoons

## Stuff done since last demo

- Basic Forth stuff (no robots yet)
- Visibility calculations

## Misc to-do items

Maze1:
- Platform physics:
  - e.g. if a platform is moved after an player above it,
    the player will never be touching the platform during its
    'am I on anything' phase, resulting in never being able to jump.
    - Changing the objects' order 'fixes' this, but causes
      movements the other way to work differently.
    - Silly but kinda works solution:
      - move entities 'moving away' (from the centers of their rooms) first
- Background layer! (just draw darker than fg)
- Create, connect new rooms interactively
- Make jumping less unreasonable
- Make jumping from on top of non-infinite-mass things workd
- Doorbell to control the door
- Keys, other inventory items

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

Boring code stuff:
- noImplicitAny: true
- noImplicitReturns: true
- strictNullChecks: true

Infrastructure:
- distributed bucket maps
- Better WebSocket demo with packets and IP6Addresses and some options on the page like which URL to connect to
- Router

Fun stuff:
- Visual demo of multi-room maze
- Visual demo of train running on tracks

- Define standard materials, including
  several for indicator lights with separate materials for each state (off, half-on, on, unspecified)
  8 lights * 4 materials for each = 32 material indexes reserved for lights
  standard index meanings for power, signal, data, us1..us3

- states, animation frames can both apply additional material map (and maybe object rotations?  sure, why not)

- Shader that forces opacity to 0 or 1
- Shader that only applies fog to opaque cells

Possibly outdated but maybe not:
- Demo for project log: Generate a bunch of different blocks from a shape
  - Need a function that takes a shape, materials, and lighting conditions
- A 'shape role' assigns specific meaning to shape parts (possibly allowing scaling)
  Shapes can indicate that they are implementing a role
- Try loading an environment map image, blurring it, reading its pixels
- Will need a base32 encoder; maybe npm has one; otherwise port yours again
  - May need to port an SHA-1 and TigerTree function, too...
- Load a spritesheet, render tiles for game
- Placeholder text/image in <canvas>
- Lightning in that demo!
  - and fb it again
- Reflection using environment map (glassy and metallic reflection)
- Import a pipe shape into the game
- Self-shadowing (not useful for tiles, but fun to play with)
- Serialize all data including preview as PNG
- Deserialize!

## Past Demos

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
* Decentish quantized physics (overlaps not allowed)
