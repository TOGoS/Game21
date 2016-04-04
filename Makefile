tsc_inputs = $(shell find -name '*.ts' | grep -v node_modules)
tsc_output = ${generated_js_files}

generated_js_files = $(shell find -name '*.ts' | grep -v node_modules | sed 's/\.ts$$/\.js/')
all_js_files = $(shell find -name '*.js') ${generated_js_files}

tsc := node_modules/typescript/bin/tsc

default: ShapeDemo.html ${generated_js_files}

clean:
	rm -rf node_modules ${generated_js_files} ShapeDemo.html ShapeDemo.html.urn

.DELETE_ON_ERROR: # yes plz

.PHONY: \
	clean \
	default \
	publish-demo

ShapeDemo.html: $(shell find -name '*.php') all.js
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

${tsc_output}: ${tsc_inputs} tsconfig.json node_modules
	${tsc} -p .

all.js: ${tsc_inputs} tsconfig.json node_modules
	${tsc} -p . --outFile "$@"

#${generated_js_files}: %.js: %.ts tsconfig.json node_modules Makefile
#	${tsc} --out "$@" "$<" --target ES5 --sourcemap --module amd
