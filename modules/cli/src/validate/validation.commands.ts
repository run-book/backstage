import { CommandContext } from "../context";
import { Command } from "commander";
import { addArraysCommand } from "../debug.commands";
import { defaultIgnoreFilter, scanDirectory } from "@laoban/fileops";
import * as yaml from 'js-yaml';
import path from "path";
import { mapK, NameAnd } from "@laoban/utils";
import { FileOps } from "@laoban/fileops";


function categorise ( contents: string ) {
  try {
    const parsed: any = yaml.load ( contents )
    return parsed?.apiVersion ? "catalog" : "valid yaml, but not a catalog";
  } catch ( e ) {
    return "invalid yaml"
  }
}

async function findAllCatalogFiles ( fileOps: FileOps, directory: string, debug ): Promise<string[]> {
  const yamls = await scanDirectory ( fileOps, defaultIgnoreFilter ) ( directory, file => file.endsWith ( '.yaml' ) )
  const results = await mapK ( yamls, async file => {
    const category = categorise ( await fileOps.loadFileOrUrl ( file ) )
    return { category, path: path.relative ( directory, file ).replace ( /\\/g, '/' ) }
  } )
  if ( debug ) {
    const max = results.map ( y => y.path.length ).reduce ( ( a, b ) => Math.max ( a, b ), 0 )
    for ( const rel of results ) console.log ( rel.path.padEnd ( max ), rel.category )
    console.log ( 'total', results.filter ( f => f.category === 'catalog' ).length, '/', results.length )
    console.log ()
  }
  return results.filter ( r => r.category === 'catalog' ).map ( r => r.path )
}

type CatalogAndBody = { body: string, catalog: string }
type FetchFn = ( url: string, init?: RequestInit ) => Promise<Response>
type ResponseOrOk = { status: number, error?: string, response?: any }
async function postAndValidate ( url: string, fetch: FetchFn, headers: NameAnd<string>, detail: CatalogAndBody ): Promise<ResponseOrOk> {
  try {
    const res = await fetch ( url, { method: 'POST', body: detail.body, headers } );
    const status = res.status
    if ( status >= 400 ) {
      const text = await res.text ()
      try {
        return { status, error: JSON.parse ( text ) }
      } catch ( e ) {
        return { status, error: text }
      }
    }
    try {
      return { status, response: await res.json () }
    } catch ( e ) {
      return { status, error: e.toString () }
    }
  } catch ( e ) {
    return { status: 500, error: e.toString () }
  }
}
export function addValidateCatalogsCommand ( context: CommandContext ) {
  const command: Command = context.command.command ( 'validate' ).description ( 'posts the catalogs to backstage with --dryrun option' )
    .option ( '--debug', 'some debugging' )
    .option ( '--backstage <backstage>', 'Where the backstage is', 'http://localhost:7007/' )
    .option ( '--backstage-path <backstagePath>', 'the path', 'api/catalog/locations?dryRun=true' )
    .option ( '--fileApi <fileApi>', 'Where the file api that serves the files is', 'http://localhost:3010/' )
    .option ( '--dryrun', 'just say what would be posted', )
    .option ( '--token-var <tokenvar>', 'The environment variable that holds the (optional) token', )
    .option ( '--bearer', 'The (optional) token is a Bearer token - if not specified it is a basic token' )
    .option ( '--errorsonly', 'only report errors' )
    .action ( async ( opts ): Promise<void> => {
      const allopts = { ...opts, ...context.command.optsWithGlobals () }
      let { directory, debug, backstage, backstagePath, fileApi, dryrun, tokenVar, bearer, errorsonly } = allopts
      directory = directory || context.currentDirectory
      const token = tokenVar ? process.env[ tokenVar ] : undefined
      if ( tokenVar && !token ) {
        console.log ( `No token found in environment variable ${tokenVar}` );
        process.exit ( 1 )
      }
      const tokenType = bearer ? 'Bearer' : 'Basic'
      const tokenHeader = token ? { 'Authorization': `${tokenType} ${token}` } : {}
      const headers = { 'Content-Type': 'application/json', ...tokenHeader }
      const catalogs = await findAllCatalogFiles ( context.fileOps, directory, debug );
      const details = catalogs.map ( catalog => {
        const body = JSON.stringify ( { type: 'url', target: fileApi + catalog } )
        return { catalog, body }
      } )
      const backstageUrl = backstage + backstagePath;
      if ( dryrun ) {
        console.log ( `Would post the following to ${backstageUrl}` )
        console.log ( 'with headers', JSON.stringify ( headers ) )
        details.forEach ( b => console.log ( b ) )
        process.exit ()
      }
      const fetches = await mapK ( details, async detail => {
        const result = await postAndValidate ( backstageUrl, context.fetch, headers, detail )
        return { catalog: detail.catalog, ...result }
      } )
      const errors = fetches.filter ( f => f.status >= 400 );
      if ( errorsonly )
        console.log ( JSON.stringify ( errors, null, 2 ) )
      else
        console.log ( JSON.stringify ( fetches, null, 2 ) )
      if ( errors.length > 0 ) process.exit ( 1 )
    } )
}

export function addListCatalogsCommand ( context: CommandContext ) {
  const command: Command = context.command.command ( 'list' ).description ( 'List all the catalogs' )
    .option ( '--debug', 'some debugging' )
    .action ( async ( opts ) => {
      const allopts = { ...opts, ...context.command.optsWithGlobals () }
      let { directory, debug } = allopts
      directory = directory || context.currentDirectory
      const catalogs = await findAllCatalogFiles ( context.fileOps, directory, debug );
      catalogs.forEach ( c => console.log ( c ) )
    } )
}

export function addValidateCommands ( context: CommandContext ) {
  const command: Command = context.command.command ( 'catalogs' ).description ( 'scans for catalog files and validates them' )
  const newContext: CommandContext = { ...context, command }
  addListCatalogsCommand ( newContext );
  addValidateCatalogsCommand ( newContext );
}