export type Parser<T> = ( s: string ) => T
export const lineParser: Parser<string[]> = ( s: string ) => s.split ( '\n' ).map ( s => s.trim () ).filter ( s => s.length > 0 )
export const jsonParser: Parser<any> = s => JSON.parse ( s )

export type PairTo<T> = ( one: string, two: string ) => T

export const parsePairOnLine = <T> ( pairTo: PairTo<T> ): Parser<T[]> =>
  s => {
    const lines = s.split ( '\n' ).map ( s => s.trim () ).filter ( s => s.length > 0 )
    return lines.map ( ( l, index ) => {
      const parts = l.split ( /\s+/g ).filter ( s => s.length > 0 )
      if ( parts.length !== 2 ) throw new Error ( `Expected 2 parts at line ${index} separated by whitespace  Got ${l} which has ${parts.length} parts` )
      return pairTo ( parts[ 0 ], parts[ 1 ] )
    } )
  }

