<?php

$mode = 'demo';
$inlineResources = false;

if( isset($argv) ) for( $i=1; $i<count($argv); ++$i ) {
	if( $argv[$i] == '--inline-resources' ) {
		$inlineResources = true;
	}
}

require 'ShapeEditor.php';