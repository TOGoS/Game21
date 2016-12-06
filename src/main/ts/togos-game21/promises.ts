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

export const RESOLVED_VOID_PROMISE:Promise<void> = resolvedPromise(undefined);
export const RESOLVED_VOID_PROMISE_CALLBACK:()=>Promise<void> = () => RESOLVED_VOID_PROMISE;

export function voidify<T>( p:Promise<T> ):Promise<void> {
    return p.then( RESOLVED_VOID_PROMISE_CALLBACK );
}

export function resolvedPromise<T>( value:T ) : Promise<T> {
    const p = Promise.resolve(value);
    (<any>p)[VALUESYM] = value;
    (<any>p)[STATESYM] = State.RESOLVED;
    return p;
}

/**
 * Add a callback to a promise so that once it resolves
 * it can be queried immediately.
 */
export function resolveWrap<X, T extends Thenable<X>>( thenable:T ):T {
    const thenableProps:any = thenable;
    if( thenableProps[STATESYM] == null ) {
        thenableProps[STATESYM] = State.NORMAL;
        thenable.then( (v:X) => {
            thenableProps[STATESYM] = State.RESOLVED;
            thenableProps[VALUESYM] = v;
        }, (error:any) => {
            thenableProps[STATESYM] = State.REJECTED;
            thenableProps[ERRORSYM] = error;
        });
    }
    return thenable;
}

export function rejectedPromise<T>( error:Error ) : Promise<T> {
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

function isThenable( v:any ):boolean {
    return v != null && v.then; 
}

function thenable<T>( v:T|Thenable<T> ):Thenable<T> {
    return isThenable(v) ? <Thenable<T>>v : resolvedPromise(v);
}

export function shortcutThen<T,U>( p:Thenable<T>, onResolve: (v:T)=>U|Thenable<U> ) : Thenable<U> {
    if( isResolved(p) ) {
        const u = onResolve(value(p));
        return isThenable(u) ? <Thenable<U>>u : resolvedPromise(u);
    }
    return p.then(onResolve);
}

/**
 * If p is null, return an immediately resolved promise.
 * Otherwise return p.
 */
export function vopToPromise<T>( p:Thenable<T>|void, v:T ):Thenable<T> {
    return p != null ? <Thenable<T>>p : resolvedPromise(v);
}

export function finalmente<T>( p:Promise<T>, finalStuff:()=>void ):Promise<T> {
	return p.then(
		(v) => { finalStuff(); return v; },
		(err) => { finalStuff(); return Promise.reject(err); }
	);
}
