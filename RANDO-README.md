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
but didn't want to horse with it for now) graphics.
You control a yellow dude who can jump around a maze.

Your goal is to find the triforce,
at which point you'll be taken to the next level.
As you progress through levels they will be more comples
and require more keys.

If you want to warp to a harder level, open the console
by hitting '/' and enter "/level <number>", e.g.

  ```/level 20```

Other console commands:

  - ```/edit-mode``` - go into editor mode.
  - ```/play-mode``` - go back into play mode.
  - ```/save``` - save the current state of the game.
  - ```/load <save game URI>```.
