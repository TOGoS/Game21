tsc_inputs = $(shell find src/main/ts)

generated_js_files = \
	$(shell find -name '*.ts' | grep -v node_modules | sed 's/\.ts$$/\.js/') \
	$(shell find -name '*.es5.js' -o -name '*.es6.js')
all_js_files = $(shell find -name '*.js') ${generated_js_files}

node := node
tsc := ${node} node_modules/typescript/bin/tsc

default: ShapeDemo.html target/cjs

sortaclean:
	rm -rf ${generated_js_files} ShapeDemo.html ShapeDemo.html.urn

clean: sortaclean
	rm -rf node_modules

.DELETE_ON_ERROR: # yes plz

.PHONY: \
	clean \
	sortaclean \
	default \
	publish-demo

ShapeDemo.html: $(shell find -name '*.php') target/game21libs.amd.es5.js
	php ShapeDemo.php --inline-resources shadowDistanceOverride=Infinity >"$@"

ShapeDemo.html.urn: ShapeDemo.html
	ccouch id "$<" >"$@"
	echo $$(cat "$@")' # '$$(date) >> ShapeDemo.html.urn.log

ShapeDemo.html.url: ShapeDemo.html.urn
	echo "http://picture-files.nuke24.net/uri-res/raw/$$(cat "$<")/ShapeDemo.html" > "$@"

publish-demo: ShapeDemo.html ShapeDemo.html.urn ShapeDemo.html.url
	cat ShapeDemo.html.url
	publish -sector build "$<"

node_modules: package.json
	npm install
	touch "$@"

target/%.js: src/main/ts/%.tsconfig.json ${tsc_inputs} node_modules
	${tsc} -p "$<" --outFile "$@"

target/cjs: src/main/ts/game21libs.cjs.es5.tsconfig.json ${tsc_inputs} node_modules
	${tsc} -p "$<" --outDir "$@"
	touch "$@"

run-unit-tests: target/cjs
	cd target/cjs && (find -name '*Test.js' | xargs ${node})

run-router: target/cjs
	node target/cjs/Router.js
