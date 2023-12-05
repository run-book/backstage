import { CommandContext } from "./context";
import { Command } from "commander";
import { FileType, fileTypeFromMd, filterFileTypes, findFilesAndFileType, loadFiles, makeDictionary, mdsToFileResults, processFileResults } from "./filetypes/filetypes";
import { hasErrors } from "@laoban/utils";
import { displayErrors, isCatalogData, isModuleDependency, ModuleData } from "./module";
import { FileOps } from "@laoban/fileops";
import { templateDir } from "./templates";
import path from "path";

export async function loadFilesAndFilesTypesForDisplay ( fileOps: FileOps, dir, fts: FileType[] ) {
  const ffts = await findFilesAndFileType ( fileOps, dir, fts )
  ffts.sort ( ( a, b ) => a.file.localeCompare ( b.file ) )
  const maxFileLength = ffts.reduce ( ( acc, { file } ) => Math.max ( acc, file.length ), 0 )
  const maxSourceType = ffts.reduce ( ( acc, { ft } ) => Math.max ( acc, ft.sourceType.length ), 0 )
  return { ffts, maxFileLength, maxSourceType };
}
export function addMakeCommand ( context: CommandContext ) {
  context.command.command ( "make" )
    .description ( "debugging" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( '-t, --template <template>', 'the root template directory. Only use if you know what you are doing', templateDir )
    .option ( '-o|--owner <owner>', 'owner of the component' )
    .option ( '-l|--lifecycle  <lifecycle>', 'owner of the component', 'experimental' )
    .option ( '--dryrun', `Don't make the files, instead state what you would create` )
    .action ( async ( opts ) => {
      const { fileTypes, debug, dryrun, template, owner, lifecycle } = opts
      const fts = filterFileTypes ( context.fileTypes, fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, dir, ffts, debug )
      const nonIgnores = loaded.filter ( md => !hasErrors ( md ) && !md.ignore )
      const fileResults = mdsToFileResults ( nonIgnores )
      const cds = await processFileResults ( fileOps, { owner, lifecycle }, template, fts, fileResults )
      for ( const cd of cds ) {
        if ( hasErrors ( cd ) ) return
        if ( dryrun ) {
          process.stdout.write ( `${cd.catalogName} ${cd.sourceType} from ${cd.pathOffset}\n` )
          process.stdout.write ( cd.value )
          process.stdout.write ( '\n\n' )
        } else
          await fileOps.saveFile ( path.join ( dir, cd.catalogName ), cd.value )
      }
      displayErrors ( cds );
    } )
}
export function addCommands ( context: CommandContext ) {
  addMakeCommand ( context );

}