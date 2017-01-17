<?php

// $rrp = runtime root path -- path to project root during execution of PHP script
// $wrp = web root path -- path to project root from perspective of web browser 

if( !isset($rrp) ) {
	$rrp = '..'; // Default
	for( $i=0; $i<5; ++$i ) {
		$rrp = $i == 0 ? '.' : implode('/', array_fill(0,$i,'..'));
		if( file_exists("$rrp/Makefile") ) break;
		$rrp = '..'; // Default
	}
}
if( !isset($wrp) ) $wrp = '..'; // Web root path (root path as it needs to be when you're visiting the page)

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
		$shouldBeBool = $prop['valueType'] == 'boolean';
		
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
	global $rrp;
	global $wrp;
	$rp = $inline ? $rrp : $wrp;
	$libsFiles = [
		$rp.'/target/alllibs.amd.es5.js'
	];
	if( $inline and $requireModuleNames !== null ) {
		foreach( $libsFiles as $libsFile ) {
			if( !file_exists($libsFile) ) throw new Exception("'$libsFile' no existy!");
		}
		$tempDir = $rrp.'/temp';
		if( !is_dir($tempDir) ) if( !mkdir($tempDir, 0777, true) ) {
			throw new Exception("Failed to mkdir('$tempDir')");
		}
		$squishFile = $tempDir.'/'.hash('sha1', implode(',', $requireModuleNames).'-'.filemtime($libsFile));
		$squishCmd = "cat ".implode(' ',$libsFiles).
					  " | $rp/bin/pruneamd -m ".escapeshellarg(implode(',', $requireModuleNames))." > $squishFile";
		//fwrite(STDERR, "$ $squishCmd\n");
		system($squishCmd, $pruneStatus);
		if( $pruneStatus !== 0 ) {
			throw new Exception("Failed to run pruner!");
		}
		$libsFiles = [$squishFile];
	}
	$requireFiles = array_merge([$rp.'/fakerequire.js'], $libsFiles);
	require_js($requireFiles, $inline);
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

function find_ts_test_modules( $reqs=[], $dir='src/main/ts', $modPfx='', array &$modules=[] ) {
	$filenames = scandir($dir);
	foreach( $filenames as $fn ) {
		$path = $dir.'/'.$fn;
		if( $fn[0] == '.' ) continue;
		if( preg_match('#^ (.*test) \.ts$#ix',$fn,$bif) ) {
			$modSource = file_get_contents($path);
			$appEnvs = null;
			if( preg_match('#^// \s* applicable-environments: \s* (.*) $#mx', $modSource, $baf) and isset($reqs['environment']) ) {
				$appEnvs = explode(', ',$baf[1]);
				$applicable = false;
				foreach( $appEnvs as $ae ) {
					if( trim($ae) == $reqs['environment'] ) $applicable = true;
				}
				if( !$applicable ) return;
			}
			$modName = $modPfx.$bif[1];
			$modules[$modName] = $modName;
		} else if( is_dir($path) ) {
			find_ts_test_modules( $reqs, $path, $modPfx.$fn.'/', $modules );
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
