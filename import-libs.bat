: Script to import libraries.
: Because `make` is totally broken on Windows.
: Or at least the version I have is.

rm -rf src/main/ts/tshash
cp -a node_modules/tshash/src/main/ts/tshash src/main/ts/tshash
