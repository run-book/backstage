import { CommandContext } from "./context";
import { FileOps } from "@laoban/fileops";
import { defaultIgnoreFilter, scanDirectory } from "@laoban/fileops/dist/src/scan";
import { dump, load } from "js-yaml";
import { deepCombineTwoObjects } from "@laoban/utils";

export type RawFileAndContents = { file: string, raw: string, contents: any }
export type FileAndError = { file: string, error: string }
export function isFileAndError ( f: FileAndContents ): f is FileAndError {
  return (f as FileAndError).error !== undefined
}
export type FileAndContents = RawFileAndContents | FileAndError
function partition ( fAndC: FileAndContents[] ): [ FileAndError[], RawFileAndContents[] ] {
  const errors: FileAndError[] = []
  const raws: RawFileAndContents[] = []
  fAndC.forEach ( f => {
    if ( isFileAndError ( f ) ) errors.push ( f )
    else raws.push ( f )
  } )
  return [ errors, raws ]
}
export function loadFiles ( fileOps: FileOps, dir: string, files: string[] ): Promise<FileAndContents[]> {
  return Promise.all ( files.map ( async file => {
    try {
      const raw = await fileOps.loadFileOrUrl ( file )
      if ( file.endsWith ( '.yaml' ) ) return { file, raw, contents: load ( raw ) }
      if ( file.endsWith ( '.json' ) ) return { file, raw, contents: JSON.parse ( raw ) }
      return { file, raw, error: 'unknown file type' }
    } catch ( e ) {
      return { file, error: e.toString () }
    }
  } ) )
}
export function addMergeCommand ( context: CommandContext ) {
  context.command.command ( "merge [files...]" )
    .description ( "Merges yaml and json files (uses extension to decide). Outputs as yaml" )
    .option ( '-j,--json', 'output as json' )
    .option ( '--debug', 'shows each file for debugging purposes' )
    .action ( async ( files, opts ) => {
      const { debug, json } = opts
      const dir = opts.directory || context.currentDirectory
      if ( debug ) console.log ( 'dir', dir )
      const fileAndContents = await loadFiles ( context.fileOps, dir, files )
      const [ errors, good ] = partition ( fileAndContents )
      if ( errors.length ) {
        console.log ( 'errors', errors )
        process.exit ( 1 )
      }
      if ( debug ) {
        console.log ( JSON.stringify ( good, null, 2 ) )
        process.exit ( 0 )
      }
      const result = good.reduce ( ( acc, f ) => deepCombineTwoObjects ( acc, f.contents ), {} )
      if ( json )
        console.log ( JSON.stringify ( result, null, 2 ) )
      else
        console.log ( dump ( result ) )
    } )
}

