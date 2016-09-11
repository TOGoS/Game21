<?php

// If rp's not set, assume we're in the demos/ directory.
if( !isset($rp) ) $rp = '..';

function load_dotenv($filename=null) {
	if( $filename === null ) $filename = __DIR__.'/../.env';
	$vals = array();
	if( !file_exists($filename) ) return $vals;
	$fh = @fopen($filename, 'rb');
	if( $fh === false ) throw new Exception("Failed to open $filename");
	while( ($line = fgets($fh)) ) {
		$line = trim($line);
		if( $line == '' or $line[0] == '#' ) continue;
		$kv = explode("=", $line, 2);
		if( count($kv) != 2 ) continue;
		$vals[$kv[0]] = $kv[1];
	}
	fclose($fh);
	return $vals;
}

function load_dotenv_transformed() {
	$rez = array();
	foreach( load_dotenv() as $k=>$v ) {
		$kp = explode('_', $k);
		$rk = $kp[0];
		for( $i=1; $i<count($kp); ++$i ) $rk .= ucfirst($kp[$i]);
	}
	return $rez;
};

function config_from_env(array $properties, array $input=array()) {
	$config = array();
	$envVals = load_dotenv_transformed();
	foreach( $properties as $k=>$prop ) {
		if( !is_array($prop) ) {
			$prop = [
				'valueType' => gettype($prop),
				'defaultValue' => $prop,
				'affects' => 'pageGeneration',
			];
		}
		
		$default = $prop['defaultValue'];
		$shouldBeBool = is_bool($default);
		
		if( isset($_REQUEST[$k]) ) $config[$k] = $_REQUEST[$k];
		else if( isset($input[$k]) ) $config[$k] = $input[$k];
		else if( isset($envVals[$k]) ) $config[$k] = $envVals[$k];
		else if( is_callable($default) ) $config[$k] = call_user_func($default, $config);
		else $config[$k] = $default;
		
		if( $shouldBeBool ) $config[$k] = parse_bool($config[$k]);
	}
	return $config;
}

function eht($text) {
	if( $text === null ) return '';
	if( is_bool($text) ) $text = $text ? 'true' : 'false';
	echo htmlspecialchars($text);
}
function ejsv($v) {
	echo json_encode($v);
}

function require_css($file, $inline=true) {
	if( $inline ) {
		echo "<style type=\"text/css\">/* <![CDATA[ */\n";
		require $file;
		echo "/* ]]> */</style>\n";
	} else {
		echo "<link rel=\"stylesheet\" type=\"text/css\" href=\"".htmlspecialchars($file)."\"/>\n";
	}
};

function require_js($files, $inline=false, $extraProps=array()) {
	$epStr = '';
	foreach( $extraProps as $k=>$v ) {
		$epStr .= " {$k}=\"".htmlspecialchars($v).'"';
	}
	
	if( is_scalar($files) ) $files = array($file);
	if( $inline ) {
		echo "<script type=\"text/javascript\"{$epStr}>/* <![CDATA[ */\n";
		foreach( $files as $file ) {
			echo "////// $file //////\n\n";
			$content = file_get_contents($file);
			// Relative sourceMappingURLs won't be valid,
			// so remove them.
			$content = preg_replace('@//#[ \t]*sourceMappingURL=([^:]*)([ \r\t]*(\n|$))@','',$content);
			echo rtrim($content), "\n";
		}
		echo "/* ]]> */</script>\n";
	} else {
		foreach( $files as $file ) {
			echo "<script type=\"text/javascript\" src=\"".htmlspecialchars($file)."\"{$epStr}></script>\n";
		}
	}
};

function require_game21_js_libs( $inline=false, $requireModuleNames=null ) {
	global $rp;
	$libsFile = $rp.'/target/game21libs.amd.es5.js';
	if( $inline and $requireModuleNames !== null ) {
		$squishFile = $rp.'/temp/'.hash('sha1', implode(',', $requireModuleNames).'-'.filemtime($libsFile));
		system("$rp/bin/pruneamd -m ".escapeshellarg(implode(',', $requireModuleNames))." < $libsFile > $squishFile", $pruneStatus);
		if( $pruneStatus !== 0 ) {
			throw new Exception("Failed to run pruner!");
		}
		$libsFile = $squishFile;
	}
	require_js([$rp.'/fakerequire.js', $libsFile], $inline);
}

function parse_bool($b, $emptyValue=false) {
	if( $b === null ) return $emptyValue;
	if( is_bool($b) ) return $b;
	if( is_numeric($b) ) {
		if( $b === 0 ) return false;
		if( $b === 1 ) return true;
	}
	if( is_string($b) ) {
		$b = strtolower(trim($b));
		switch( $b ) {
		case '': return $emptyValue;
		case 'yes': case 'y': case 't': case 'true': case 'on':
			return true;
		case 'no': case 'n': case 'f': case 'false': case 'off':
			return false;
		}
	}
	throw new Exception("Unrecognized representatin of boolean: ".var_export($b,true));
}

/**
 * Fit iw,ih into cw,ch, preserving aspect ratio
 */
function fitpar($cw, $ch, $iw, $ih) {
	if( $iw < $cw ) {
		$ih *= ($cw / $iw);
		$iw = $cw;
	} else if( $ih < $ch ) {
		$iw *= ($ch / $ih);
		$ih = $ch;
	}
	if( $iw > $cw ) {
		$ih *= ($cw / $iw);
		$iw = $cw;
	}
	if( $ih > $ch ) {
		$iw *= ($ch / $ih);
		$ih = $ch;
	}
	return array($iw, $ih);
}

function find_ts_test_modules( $dir='src/main/ts', $modPfx='', array &$modules=[] ) {
	$filenames = scandir($dir);
	foreach( $filenames as $fn ) {
		if( $fn[0] == '.' ) continue;
		if( preg_match('/^(.*Test)\.ts$/',$fn,$bif) ) {
			$modName = $modPfx.$bif[1];
			$modules[$modName] = $modName;
		} else if( is_dir($subDir = $dir.'/'.$fn) ) {
			find_ts_test_modules( $subDir, $modPfx.$fn.'/', $modules );
		}
	}
	return $modules;
}

function ezdie() {
	header('Status: 500 ezdied');
	header('HTTP/1.0 500 ezdied');
	header('Content-Type: text/plain');
	$args = func_get_args();
	foreach( $args as $a ) {
		print_r($a);
	}
	exit(1);
};
