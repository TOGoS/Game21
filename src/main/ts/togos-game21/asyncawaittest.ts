import { registerTestResult, assertEqualsPromise } from './testing';

async function pram(k:string, v:string) {
	return k+'='+v;
}

async function loopi(things:{[k:string]: string}, callback:(k:string, v:string)=>Promise<string> ) {
	const rez:string[] = [];
	for( let k in things ) {
		rez.push(await callback(k, things[k]));
	}
	return rez.join('&');
}

registerTestResult("async loop thing", loopi({
	x: 'ecks', y: 'why', z:'zee'
}, pram).then( (res) => {
	return assertEqualsPromise('x=ecks&y=why&z=zee', res);
}));
