tsc_inputs = $(shell find src/main/ts) src/main/ts/tshash

generated_js_files = \
	$(shell find . -name '*.ts' | grep -v node_modules | sed 's/\.ts$$/\.js/') \
	$(shell find . -name '*.es5.js' -o -name '*.es6.js')
all_js_files = $(shell find . -name '*.js') ${generated_js_files}

node := node
tsc := ${node} node_modules/typescript/bin/tsc

default: js-libs

js-libs: target/cjs target/game21libs.amd.es5.js

sortaclean:
	rm -rf ${generated_js_files} demos/*.html demos/*.html.urn demos/*.url target

clean: sortaclean
	rm -rf node_modules

.DELETE_ON_ERROR: # yes plz

.SECONDARY: # Don't delete intermediate files.

.PHONY: \
	clean \
	default \
	js-libs \
	publish-demo \
	sortaclean

demos/Maze1.html: demos/Maze1.php $(shell find . -name '*.php') target/game21libs.amd.es5.js
	php demos/Maze1.php saveGameRef=demo --inline-resources > "$@"
demos/RandomMazes.html: demos/Maze1.php $(shell find . -name '*.php') target/game21libs.amd.es5.js
	php demos/Maze1.php tabSwitchesMode=false --inline-resources > "$@"
demos/RandomMazesDoc.html: demos/Maze1.php $(shell find . -name '*.php') target/game21libs.amd.es5.js
	php demos/Maze1.php tabSwitchesMode=false includeFakeContent=true --inline-resources > "$@"
plog/entries/21: demos/Maze1.php $(shell find . -name '*.php') target/game21libs.amd.es5.js
	mkdir -p plog/entries/
	php demos/Maze1.php asPlogEntry=21 > "$@"

demos/%.html: demos/%.php $(shell find . -name '*.php') target/game21libs.amd.es5.js
	cd demos && php "../$<" --inline-resources >"../$@"

target/Game21RandomMazes-%.zip: demos/RandomMazes.html
	zip -r "$@" RANDO-README.md src Makefile package.json \
		demos/lib.php demos/Maze1.php demos/RandomMazes.html \
		mazes.lst bin/pruneamd fakerequire.js

%.urn: % Makefile
	ccouch3 id "$<" >"$@"
	echo $$(cat "$@")' # '$$(date) >> "$<".urn.log

%.url: % %.urn Makefile
	echo "http://picture-files.nuke24.net/uri-res/raw/$$(cat "$<".urn)/$(notdir $<)" > "$@"
	publish -sector pictures "$<"

publish-demo: demos/ShapeDemo.html.url

node_modules: package.json
	npm install
	touch "$@"
	touch node_modules/tshash/src/main/ts/tshash

node_modules/tshash/src/main/ts/tshash: node_modules

# TypeScript libraries that need to be copied in because tsc can only handle one source folder...
src/main/ts/tshash: node_modules/tshash/src/main/ts/tshash
	rm -rf "$@"
	cp -a "$<" "$@"
	touch "$@"

target/%.js: src/main/ts/%.tsconfig.json ${tsc_inputs} node_modules
	${tsc} -p "$<" --outFile "$@"

target/cjs: src/main/ts/game21libs.cjs.es5.tsconfig.json ${tsc_inputs} node_modules
	${tsc} -p "$<" --outDir "$@"
	touch "$@"

run-unit-tests: target/cjs
	@# Normally I'd xargs --no-run-if-empty, but
	@# (A) FreeBSD (i.e. Mac OS X) doesn't have it, and
	@# (B) There should always be some tests.
	cd target/cjs && (find . -iname '*Test.js' | xargs -n 1 ${node})
run-unit-tests-verbosely: target/cjs
	cd target/cjs && (find . -iname '*Test.js' | xargs -n 1 -I'{}' ${node} '{}' -v)

run-router: target/cjs
	node target/cjs/togos-game21/Router.js

build.log: $(shell find src)
	-${MAKE} run-unit-tests >build2.log 2>&1
	mv build2.log build.log
