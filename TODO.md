- noImplicitAny: true
- noImplicitReturns: true

- Make a train run on the rails

- Define standard materials, including
  several for indicator lights with separate materials for each state (off, half-on, on, unspecified)
  8 lights * 4 materials for each = 32 material indexes reserved for lights
  standard index meanings for power, signal, data, us1..us3

- states, animation frames can both apply additional material map (and maybe object rotations?  sure, why not)

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
