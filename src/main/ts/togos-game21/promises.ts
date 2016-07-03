/// <reference path="../Promise.d.ts"/>

declare function Symbol(x:string):symbol;

const RESOLVEDSYM = Symbol("resolved");
const VALUESYM = Symbol("value");

export function resolvedPromise<T>( value:T ) : Promise<T> {
    const p = Promise.resolve(value);
    (<any>p)[VALUESYM] = value;
    (<any>p)[RESOLVEDSYM] = true;
    return p;
}

export function isResolved<T>( p:Promise<T> ):boolean {
    return (<any>p)[RESOLVEDSYM] === true;
}

export function value<T>( p:Promise<T> ):T {
    return <T>((<any>p)[VALUESYM]);
}

export function shortcutThen<T>( p:Promise<T>, onResolve: (v:T)=>any ) {
    if( isResolved(p) ) onResolve(value(p));
    p.then(onResolve);
}