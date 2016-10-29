export type FitnessFunction<T> = (x:T)=>number;

export const EVERYTHING_FITS:FitnessFunction<any> = (x)=>1;

export function randInt(min:number, max:number) {
	const m = Math.floor(max-min)+1;
	return min + Math.floor( m * Math.random() );
}

export function nMostFit<T>( coll:T[], count:number, fitnessFunction:FitnessFunction<T>, collectionDescription:string="items", minFitness:number=0, minCount:number=1 ):T[] {
	type WithFitness<T> = [T,number];
	const withFitness = coll.map( (n):WithFitness<T> => [n,fitnessFunction(n)] );
	const filtered = withFitness.filter( ([n,fit]) => fit >= minFitness );
	if( filtered.length < minCount ) throw new Error("Found only "+filtered.length+" of "+minCount+" "+collectionDescription);
	const sorted = filtered.sort( ([n0,fit0],[n1,fit1]) => fit0 > fit1 ? -1 : fit0 == fit1 ? 0 : +1 );
	return sorted.slice(0, count).map( ([n,fit]) => n );
}

export function bestFit<T>( coll:T[], fitnessFunction:FitnessFunction<T>, resultDescription:string="item" ):T {
	let bestFitness:number = 0;
	let bestFit:T|undefined = undefined;
	for( let i in coll ) {
		const item:T = coll[i];
		const fitness = fitnessFunction(item);
		if( fitness > bestFitness ) {
			bestFitness = fitness;
			bestFit = item;
		}
	}
	if( bestFit == undefined ) throw new Error("Can't pick "+resultDescription+"; no items had fitness > 0!");
	return bestFit;
}

export function pickOne<T>( t:T[] ):T {
	if( t.length == 0 ) throw new Error("Can't pick from zero-length list!")
	return t[Math.floor(Math.random()*t.length)];
}
