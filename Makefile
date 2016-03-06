ShapeDemo.html: *.php *.js
	php ShapeDemo.php >"$@"

ShapeDemo.html.urn: ShapeDemo.html
	ccouch id "$<" >"$@"
	echo $$(cat "$@")' # '$$(date) >> ShapeDemo.html.urn.log

ShapeDemo.html.url: ShapeDemo.html.urn
	echo "http://picture-files.nuke24.net/uri-res/raw/$$(cat "$<")/ShapeDemo.html" > "$@"

publish-demo: ShapeDemo.html ShapeDemo.html.urn ShapeDemo.html.url
	cat ShapeDemo.html.url
	publish -sector build "$<"
