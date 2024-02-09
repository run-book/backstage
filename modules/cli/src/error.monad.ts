export interface HasErrors {
  errorContext?: string
  error?: string
}
export function hasError<T extends HasErrors> ( t: T ): boolean {
  return t.error !== undefined
}
export function mapErrors<T extends HasErrors, T1 extends HasErrors> ( errorContext: string, t: T, fn: ( t: T ) => T1 ): T1 {
  if ( t.error ) {return t as any as T1} else {
    try {
      return fn ( t )
    } catch ( e ) {
      return { errorContext, error: e.toString () } as T1
    }
  }
}
export const mapErrorsFn = <T extends HasErrors, T1 extends HasErrors> ( errorContext: string, fn: ( t: T ) => T1 ) => {
  return ( t: T ): T1 => mapErrors ( errorContext, t, fn )
}

export function mapErrorsK<T extends HasErrors, T1 extends HasErrors> ( errorContext: string, t: T, fn: ( t: T ) => Promise<T1> ): Promise<T1> {
  if ( t.error ) {
    return Promise.resolve ( t as any as T1 )
  } else {
    return fn ( t ).catch ( e => ({ errorContext, error: e.toString () } as T1) )
  }
}

export function mapErrorsFnK<T extends HasErrors, T1 extends HasErrors> ( errorContext: string, fn: ( t: T ) => Promise<T1> ): ( t: T ) => Promise<T1> {
  return t => mapErrorsK ( errorContext, t, fn )
}

export function mapErrorsListK<T extends HasErrors, T1 extends HasErrors> ( errorContextFn: ( t: T ) => string, ts: T[], fn: ( t: T ) => Promise<T1> ): Promise<T1[]> {
  return Promise.all ( ts.map ( t => mapErrorsK ( errorContextFn ( t ), t, fn ) ) )
}
export function flatMapErrorsListK<T extends HasErrors, T1 extends HasErrors> ( errorContextFn: ( t: T ) => string, ts: T[], fn: ( t: T ) => Promise<T1[]> ): Promise<T1[]> {
  return Promise.all ( ts.map ( t => {
    if ( t.error ) return [ t as any as T1 ]
    else return fn ( t ).catch ( e => [ { errorContext: errorContextFn ( t ), error: e.toString () } as T1 ] )
  } ) ).then ( x => x.flat () )
}

export function composeErrors<From, Mid extends HasErrors, To extends HasErrors> ( fn1: ( from: From ) => Mid, fn2: ( from: Mid ) => To ) {
  return ( from: From ) => mapErrorsFn ( 'composeErrors', fn2 ) ( fn1 ( from ) )
}
export const composeErrorsK = <From, Mid extends HasErrors, To extends HasErrors> ( fn1: ( from: From ) => Promise<Mid>, fn2: ( from: Mid ) => To ) =>
  async ( from: From ): Promise<To> => mapErrorsFn ( 'composeErrorsK', fn2 ) ( await fn1 ( from ) )

