tsc_inputs = $(shell find src/main/ts) src/main/ts/tshash

generated_js_files = \
	$(shell find -name '*.ts' | grep -v node_modules | sed 's/\.ts$$/\.js/') \
	$(shell find -name '*.es5.js' -o -name '*.es6.js')
all_js_files = $(shell find -name '*.js') ${generated_js_files}

node := node
tsc := ${node} node_modules/typescript/bin/tsc

default: demos/ShapeDemo.html target/cjs

sortaclean:
	rm -rf ${generated_js_files} demos/*.html demos/*.html.urn demos/*.url

clean: sortaclean
	rm -rf node_modules

.DELETE_ON_ERROR: # yes plz

.SECONDARY: # Don't delete intermediate files.

.PHONY: \
	clean \
	sortaclean \
	default \
	publish-demo

demos/%.html: demos/%.php $(shell find -name '*.php') target/game21libs.amd.es5.js
	cd demos && php "../$<" --inline-resources >"../$@"

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
	cd target/cjs && (find -name '*Test.js' | xargs --no-run-if-empty -n 1 ${node})

run-router: target/cjs
	node target/cjs/togos-game21/Router.js
