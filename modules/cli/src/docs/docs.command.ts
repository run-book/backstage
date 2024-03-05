import { hasErrors } from "@laoban/utils";
import path from "path";
import { FileType, filterFileTypes, findFilesAndFileType, loadFiles, processFileResults } from "../filetypes/filetypes";
import { CommandContext } from "../context";
import { templateDir } from "../templates";
import { loadPolicy } from "../policy";
import { loadTemplateAndMakeLocationFiles } from "../locations";
import { displayErrors, ModuleData, ModuleDataWithoutErrors } from "../module";
import { FileOps } from "@laoban/fileops";
import * as fs from "fs";

export async function loadFilesAndFilesTypesForDisplay ( fileOps: FileOps, dir, fts: FileType[] ) {
  const ffts = await findFilesAndFileType ( fileOps, dir, fts )
  ffts.sort ( ( a, b ) => a.file.localeCompare ( b.file ) )
  const maxFileLength = ffts.reduce ( ( acc, { file } ) => Math.max ( acc, file.length ), 0 )
  const maxSourceType = ffts.reduce ( ( acc, { ft } ) => Math.max ( acc, ft.sourceType.length ), 0 )
  return { ffts, maxFileLength, maxSourceType };
}

async function fileExists ( dir: string, file: string ): Promise<boolean> {
  try {
    const stats = await fs.promises.stat ( path.join ( dir, file ) )
    return stats.isFile ()
  } catch ( e ) {
    return false
  }
}
export async function categoriseModuleForDocs ( rootDir: string, md: ModuleDataWithoutErrors ): Promise<string | undefined> {
  const dir = path.join ( rootDir, path.dirname ( md.pathOffset ) )
  if ( await fileExists ( dir, 'mkdocs.yml' ) ) return 'mkdocs.yml'
  if ( await fileExists ( dir, 'mkdocs.yaml' ) ) return 'mkdocs.yaml'
  if ( await fileExists ( dir, 'README.md' ) ) return 'README.md'
  return undefined
}
export function addMakeDocs ( context: CommandContext ) {
  context.command.command ( "docs" )
    .description ( "Makes mkdocs files from the readme if it doesn't exist" )
    .option ( 'p, --policy <policy>', 'policy url' )
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

      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, await loadPolicy ( fileOps, policy ), dir, ffts, debug )
      if ( debug ) console.log ( 'loaded', loaded )
      for ( const md of loaded ) {
        if ( hasErrors ( md ) ) console.log ( 'errors', md ); else {
          const cat = await categoriseModuleForDocs ( dir, md )
          console.log ( md.catalogName, cat )
        }
      }
    } )
}
