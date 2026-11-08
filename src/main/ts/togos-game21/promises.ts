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

export function resolvedPromise<T>( value:T ) : Promise<T> {
    const p = Promise.resolve(value);
    (<any>p)[VALUESYM] = value;
    (<any>p)[STATESYM] = State.RESOLVED;
    return p;
}

export function rejectedPromise<T>( error:Error ) : Promise<T> {
    const p = Promise.reject(error);
    (<any>p)[ERRORSYM] = error;
    (<any>p)[STATESYM] = State.REJECTED;
    return p;
}

export function isResolved<T>( p:PromiseLike<T> ):boolean {
    return (<any>p)[STATESYM] === State.RESOLVED;
}

export function isRejected<T>( p:PromiseLike<T> ):boolean {
    return (<any>p)[STATESYM] === State.REJECTED;
}

export function value<T>( p:PromiseLike<T> ):T {
    return <T>((<any>p)[VALUESYM]);
}

function isPromiseLike<T>( v : T | PromiseLike<T> ):v is PromiseLike<T> {
    return v != null && typeof (v as any).then == "function";
}

export function shortcutThen<T,U>( p:PromiseLike<T>, onResolve: (v:T)=>U|PromiseLike<U> ) : PromiseLike<U> {
    if( isResolved(p) ) {
        const u = onResolve(value(p));
        return isPromiseLike(u) ? u : resolvedPromise(u);
    }
    return p.then(onResolve as (value:T)=>U|PromiseLike<U>);
}

/**
 * If p is null, return an immediately resolved promise.
 * Otherwise return p.
 */
export function vopToPromise<T>( p:PromiseLike<T>|void, v:T ):PromiseLike<T> {
    return p != null ? <PromiseLike<T>>p : resolvedPromise(v);
}

export function finalmente<T>( p:Promise<T>, finalStuff:()=>void ):Promise<T> {
	return p.then(
		(v) => { finalStuff(); return v; },
		(err) => { finalStuff(); return Promise.reject(err); }
	);
}
