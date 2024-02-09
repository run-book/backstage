import { composeErrorsK, HasErrors, mapErrorsFn, mapErrorsK } from "../error.monad";
import { FileOps } from "@laoban/fileops";
import { Parser } from "./parser";

export interface HasUrl extends HasErrors {
  url: string
}
export interface HasLines {
  lines?: string
  error?: string
}

export type LinesAnd<T> = T & HasErrors & HasLines
export type LinesAndJsonAnd<T, JSON> = T & HasErrors & HasLines & { json: JSON }

export const mapLinesAndJsonAnd = <T, Line, T2> ( fn: ( t: T, line: Line ) => T2 ) => ( raw: LinesAndJsonAnd<T, Line[]> ): T2[] => {
  if ( raw.error ) return [ raw as any as T2 ]
  return raw.json.map ( l => fn ( raw, l ) )
};

export const parse = <T, Res> ( context: string, parser: Parser<Res> ): ( t: LinesAnd<T> ) => LinesAndJsonAnd<T, Res> =>
  mapErrorsFn<LinesAnd<T>, LinesAndJsonAnd<T, Res>> ( context, lt =>
    ({ ...lt, json: parser ( lt.lines ) }) )

export const fetchLines = ( fileOps: FileOps, context: string ) => <T extends HasUrl> ( t: T ) =>
  mapErrorsK<T, LinesAnd<T>> ( `${context} ${t.url}`, t, async t =>
    ({ ...t, lines: await fileOps.loadFileOrUrl ( t.url ) }) )

export const fetchLinesAndParse = <T extends HasUrl, Res> ( fileOps: FileOps, context: string, parser: Parser<Res> ): ( t: T ) => Promise<LinesAndJsonAnd<T, Res>> =>
  composeErrorsK ( fetchLines ( fileOps, context ), parse ( context, parser ) )

