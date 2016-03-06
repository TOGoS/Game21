<?php

$mode = 'demo';
$inlineResources = true;

if( isset($argv) ) for( $i=1; $i<count($argv); ++$i ) {
	if( $argv[$i] == '--inline-resources' ) {
		$inlineResources = true;
	}
}

require 'ShapeEditor.php';