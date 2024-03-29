import { CommandContext } from "./context";
import { FileType, filterFileTypes, findFilesAndFileType, loadFiles, processFileResults } from "./filetypes/filetypes";
import { hasErrors } from "@laoban/utils";
import { displayErrors } from "./module";
import { FileOps } from "@laoban/fileops";
import { templateDir } from "./templates";
import path from "path";
import { loadPolicy } from "./policy";
import { loadTemplateAndMakeLocationFiles } from "./locations";

export async function loadFilesAndFilesTypesForDisplay ( fileOps: FileOps, dir, fts: FileType[] ) {
  const ffts = await findFilesAndFileType ( fileOps, dir, fts )
  ffts.sort ( ( a, b ) => a.file.localeCompare ( b.file ) )
  const maxFileLength = ffts.reduce ( ( acc, { file } ) => Math.max ( acc, file.length ), 0 )
  const maxSourceType = ffts.reduce ( ( acc, { ft } ) => Math.max ( acc, ft.sourceType.length ), 0 )
  return { ffts, maxFileLength, maxSourceType };
}
export function addMakeCommand ( context: CommandContext ) {
  context.command.command ( "make" )
    .description ( "Makes component files for backstage" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( 'p, --policy <policy>', 'policy url' )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( '-t, --template <template>', 'the root template directory. Only use if you know what you are doing', templateDir )
    .option ( '-o, --owner <owner>', 'owner of the component' )
    .option ( "-n, --name <name>", "A name is needed for the locations files. This can be provided from package.json, or pom.xml. But otherwise this is needed" )
    .option ( '-l, --lifecycle  <lifecycle>', 'owner of the component', 'experimental' )
    .option ( '--dryrun', `Don't make the files, instead state what you would create` )
    .action ( async ( opts ) => {
      const { fileTypes, debug, dryrun, template, owner, lifecycle, policy, name } = opts
      const fts = filterFileTypes ( context.fileTypes, fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, await loadPolicy ( fileOps, policy ), dir, ffts, debug )
      const cds = await processFileResults ( fileOps, { owner, lifecycle }, template, fts, loaded )
      const roots = await loadTemplateAndMakeLocationFiles ( fileOps, template, loaded, name, false )
      const all = [ ...cds, ...roots ]
      for ( const cd of all ) {
        if ( hasErrors ( cd ) ) continue
        if ( dryrun ) {
          process.stdout.write ( `[${cd.catalogName}] ${cd.sourceType} from [${cd.pathOffset}]\n` )
          process.stdout.write ( cd.value )
          process.stdout.write ( '\n\n' )
        } else {
          const filename = path.join ( dir, cd.catalogName );
          await fileOps.saveFile ( filename, cd.value )
        }
      }
      displayErrors ( all );
    } )
}
export function addMakeCommands ( context: CommandContext ) {
  addMakeCommand ( context );
}