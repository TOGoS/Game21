/// <reference path="../Promise.d.ts"/>

declare function Symbol(x:string):symbol;

enum State {
    NORMAL,
    RESOLVED,
    REJECTED
} 

const STATESYM = Symbol("resolved");
const VALUESYM = Symbol("value");
const ERRORSYM = Symbol("value");

export function resolvedPromise<T>( value:T ) : Thenable<T> {
    const p = Promise.resolve(value);
    (<any>p)[VALUESYM] = value;
    (<any>p)[STATESYM] = State.RESOLVED;
    return p;
}

export function rejectedPromise<T>( error:any ) : Thenable<T> {
    const p = Promise.reject(value);
    (<any>p)[ERRORSYM] = error;
    (<any>p)[STATESYM] = State.REJECTED;
    return p;
}

export function isResolved<T>( p:Thenable<T> ):boolean {
    return (<any>p)[STATESYM] === State.RESOLVED;
}

export function isRejected<T>( p:Thenable<T> ):boolean {
    return (<any>p)[STATESYM] === State.REJECTED;
}

export function value<T>( p:Thenable<T> ):T {
    return <T>((<any>p)[VALUESYM]);
}

export function shortcutThen<T,U>( p:Thenable<T>, onResolve: (v:T)=>U|Thenable<U> ) : Thenable<U> {
    if( isResolved(p) ) {
        const u = onResolve(value(p));
        return (<Thenable<U>>u).then ? <Thenable<U>>u : resolvedPromise(u);
    }
    return p.then(onResolve);
}

/**
 * If p is null, return an immediately resolved promise.
 * Otherwise return p.
 */
export function vopToPromise<T>( p:Thenable<T>|void, v:T ):Thenable<T> {
    return p == null ? resolvedPromise(v) : <Promise<T>>p;
}
