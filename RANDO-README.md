# TOGoS's Random Dungeon Game

## Setup

If you got this as a zip file, it should include demos/RandomMazes.html.
It is totally self-contained and contains the entire game.
Open that in your browser.

Otherwise, you can build using ```make```.
A recent version of Node and NPM is required.

Source code is in ```src```.

## The Game

It is a 2-D side-scroller with intentionally primitive
(because I have a fancy graphics generator in the works
but wanted the focus to be on the maze generation for now) graphics.
You control a yellow character who can jump around a maze.

Your goal is to find the triforce,
at which point you'll be taken to the next level.
As you progress through levels they will be more complex
and require more keys.

Use W,A,S,D or arrow keys to move.  W or up arrow jumps.

Your character will automatically pick up items that they run into.
When inventory is full, they'll automatically discard less important
items (like sticks) to make room for more important ones
(like keys).

You can toss away inventory items by clicking.

You will use up energy (especially while climbing ladders!)
while moving around the maze.  If you reach zero you die.
Find apples to replenish.

If you want to warp to a harder level, open the console
by hitting '/' and enter "/level _n_", e.g.

  ```/level 20```

Other console commands:

  - ```/edit-mode``` - go into editor mode.  This is cheating.
  - ```/play-mode``` - go back into play mode.
  - ```/save``` - save the current state of the game.
  - ```/load <save game URN>``` - note that the save game URN
    requires quotes because of the trailing '#',
    e.g. ```/load "urn:sha1:VLHTMPIMN2QQVNXZPH2XZXU7WH7ZEJ4M#"```.
    If you leave the quotes off, ```#``` inidcates start of line comment.
    But the ```load``` command will guess what you meant.
  - ```/give <item class ID>``` - give yourself an item.  This is cheating.
  - ```/sound-effects {on|off}``` - turn sound effects on or off.

When in edit mode, click to place blocks and control+click
to copy blocks into your block palette.
You can click different block palette entries to select them.

You can place items by ```give```ing them to yourself and then throwing them.