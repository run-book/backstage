import { CommandContext } from "./context";
import { Command } from "commander";
import { fileTypeFromMd, filterFileTypes, isModuleDependencyFileType, justModuleDependenciesForFtWithLocalDeps, loadFiles, makeDictionary, withoutErrors } from "./filetypes/filetypes";
import { flatMapK, hasErrors } from "@laoban/utils";
import { CatalogData, debugStringForMd, displayErrors, isCatalogData, isModuleDependency, ModuleData, moduleDataPath, ModuleDataWithoutErrors } from "./module";
import { loadFilesAndFilesTypesForDisplay } from "./commands";
import { makeTreeFromPathFnAndArray, treeToString } from "./tree";
import { loadPolicy } from "./policy";
import { loadTemplateAndMakeLocationFiles, makeLocationFiles } from "./locations";
import { templateDir } from "./templates";
import { listFilesRecursively } from "./file.search";
import path from "path";
import { FileOps } from "@laoban/fileops";


export function addDataCommand ( context: CommandContext ) {
  context.command.command ( "data" )
    .description ( "debugging - all the module data from the file - does not include data in parent" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( 'a, --all', 'include ignored files' )
    .option ( 'p, --policy <policy>', 'policy url' )
    .option ( '-d, --debug', 'output extra debugging' )
    .action ( async ( opts ) => {
      const { fileTypes, debug, all, policy } = opts
      const fts = filterFileTypes ( context.fileTypes, opts.fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, await loadPolicy ( fileOps, policy ), dir, ffts, debug )
      loaded.forEach ( md => {
        if ( hasErrors ( md ) ) return
        if ( md.ignore && !all ) return
        const ft = fileTypeFromMd ( fts, md );
        process.stdout.write ( `${md.pathOffset.padEnd ( maxFileLength )} ${md.sourceType.padEnd ( maxSourceType )} ${JSON.stringify ( md )}\n` )
      } )
      displayErrors ( loaded );
    } )
}

export function addArraysCommand ( context: CommandContext ) {
  context.command.command ( "arrays" )
    .description ( "debugging - shows the relationships between parents and entities" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .action ( async ( opts ) => {
      const { fileTypes, debug, policy } = opts
      const fts = filterFileTypes ( context.fileTypes, opts.fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, await loadPolicy ( fileOps, policy ), dir, ffts, debug )

      for ( const ft of fts ) {
        if ( isModuleDependencyFileType ( ft ) ) {
          const withLocalDeps = justModuleDependenciesForFtWithLocalDeps ( loaded, ft )
          const helper = ft.makeArrayHelper ( withLocalDeps )
          const arrays = withLocalDeps.map ( ft.makeArray ( helper ) )
          for ( const array of arrays ) {
            const arrayString = array.map ( md => hasErrors ( md ) ? '' : md.pathOffset.padEnd ( maxFileLength ) ).join ( ' ' )
            process.stdout.write ( `${ft.sourceType.padEnd ( maxSourceType )} [${array.length}]  ${arrayString}\n` )
          }
        }
      }
      displayErrors ( loaded );
    } )
}
export function addTreesCommands ( context: CommandContext ) {
  context.command.command ( "trees" )
    .description ( "Shows the trees based just on the path" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( 'a, --all', 'include ignored files' )
    .option ( 'p, --policy <policy>', 'policy url' )
    .option ( '-o, --owner <owner>', 'owner of the component' )
    .option ( '-l, --lifecycle  <lifecycle >', 'owner of the component, "experimental' )
    .action ( async ( opts ) => {
      const { fileTypes, debug, policy } = opts
      const fts = filterFileTypes ( context.fileTypes, fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, await loadPolicy ( fileOps, policy ), dir, ffts, debug )
      const trees = makeTreeFromPathFnAndArray<ModuleData> ( moduleDataPath, loaded )
      const roots = Object.values ( trees ).filter ( t => t.parent === undefined )
      for ( const root of roots ) {
        const treeString = treeToString ( root, debugStringForMd, 0 )
        process.stdout.write ( `${treeString}\n` )
      }
      displayErrors ( loaded );
    } )
}

export function addTemplateVarsCommand ( context: CommandContext ) {
  context.command.command ( "vars" )
    .description ( "debugging - the variables available to templates" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( 'p, --policy <policy>', 'policy url' )
    .option ( '-o, --owner <owner>', 'owner of the component' )
    .option ( '-l, --lifecycle  <lifecycle >', 'owner of the component, "experimental' )
    .action ( async ( opts ) => {
      const { fileTypes, debug, policy, owner, lifecycle } = opts
      const fts = filterFileTypes ( context.fileTypes, fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, await loadPolicy ( fileOps, policy ), dir, ffts, debug )
      for ( const ft of fts ) {
        if ( isModuleDependencyFileType ( ft ) ) {
          const withLocalDeps = justModuleDependenciesForFtWithLocalDeps ( loaded, ft );
          const helper = ft.makeArrayHelper ( withLocalDeps )
          const arrays = withLocalDeps.map ( ft.makeArray ( helper ) )
          for ( const array of arrays ) {
            const md = array[ array.length - 1 ]
            const dic = makeDictionary ( { owner, lifecycle }, array )
            process.stdout.write ( `${md.pathOffset.padEnd ( maxFileLength )} ${md.sourceType.padEnd ( maxSourceType )} ${JSON.stringify ( dic )}\n` )
          }
        }
      }
      displayErrors ( loaded );
    } )
}
export function addFilesCommand ( context: CommandContext ) {
  context.command.command ( "files" )
    .description ( "shows all the places catalog-info.xxx.yaml files will be added (so not the location files)" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( 'a, --all', 'include ignored files' )
    .option ( 'p, --policy <policy>', 'policy url' )
    .action ( async ( opts ) => {
      const { fileTypes, debug, policy, all } = opts
      const fts = filterFileTypes ( context.fileTypes, opts.fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const mds = await loadFiles ( fileOps, await loadPolicy ( fileOps, policy ), dir, ffts, debug )
      const maxCatalog = withoutErrors(mds).reduce ( ( acc, md ) => Math.max ( acc, md.catalogName.length ), 0 )
      for ( const md of mds ) {
        if ( hasErrors ( md ) ) continue
        if ( md.ignore && !all ) continue
        const ignore = all ? (md.ignore ? ' ignore' : '       ') : ''
        process.stdout.write ( `${md.catalogName.padEnd ( maxCatalog )} ${md.sourceType.padEnd ( maxSourceType )}${ignore} from ${md.pathOffset}\n` )
      }
      displayErrors ( mds );
    } )
}

export function addListCommand ( context: CommandContext ) {
  context.command.command ( "list" )
    .description ( "list all modules." )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( 'a, --all', 'include ignored files' )
    .option ( 'p, --policy <policy>', 'policy url' )
    .action ( async ( opts ) => {
      const { fileTypes, debug, all, policy } = opts
      const fts = filterFileTypes ( context.fileTypes, opts.fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, await loadPolicy ( fileOps, policy ), dir, ffts, debug )
      for ( const md of loaded ) {
        if ( hasErrors ( md ) ) continue
        if ( md.ignore && !all ) continue
        const ignore = md.ignore ? 'ignore' : '      '
        const displayPath = md.pathOffset.padEnd ( maxFileLength );
        const displaySourceType = md.sourceType.padEnd ( maxSourceType );
        if ( isModuleDependency ( md ) ) {
          console.log ( displayPath, displaySourceType, ignore );
        } else if ( isCatalogData ( md ) ) {
          console.log ( displayPath, displaySourceType, ignore );
        } else
          console.log ( displayPath, displaySourceType, ignore, 'unknown' );
      }
      displayErrors ( loaded );
    } )
}

export function addNukeCommand ( { fileOps, currentDirectory, command }: CommandContext ) {
  command.command ( "nuke" )
    .description ( "removes any .yaml files that start with # Autogenerated" )
    .option ( "--dryrun", "don't actually remove the files" )
    .action ( async ( opts ) => {
      const { dryrun } = opts
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const yamlFiles = await listFilesRecursively ( fileOps, dir, f => f.endsWith ( ".yaml" ) );
      const toDelete = await flatMapK ( yamlFiles, async f => {
        const content = await fileOps.loadFileOrUrl ( f );
        return content.startsWith ( "# Autogenerated" ) ? [ f ] : [];
      } );
      for ( const f of toDelete ) {
        console.log ( `Deleting ${f}` );
        if ( !dryrun ) await fileOps.removeFile ( f );
      }
    } )
}
export function addLocationsCommand ( context: CommandContext ) {
  context.command.command ( "locations" )
    .description ( "show all the places that location files will be added, and optionally their content" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( "--content", "show the content of the location files" )
    .option ( "-n, --name <name>", "A name is needed for the locations files. This can be provided from package.json, or pom.xml. But otherwise this is needed", 'demoName' )
    .option ( 'p, --policy <policy>', 'policy url' )
    .option ( '-t, --template <template>', 'the root template directory. Only use if you know what you are doing', templateDir )
    .action ( async ( opts ) => {
      const { fileTypes, debug, content, all, policy, template, name } = opts
      const fts = filterFileTypes ( context.fileTypes, opts.fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, await loadPolicy ( fileOps, policy ), dir, ffts, debug )
      const roots = await loadTemplateAndMakeLocationFiles ( fileOps, template, loaded, name, all )
      const rootsWithoutErrors = roots.filter ( r => !hasErrors ( r ) ) as CatalogData[]
      rootsWithoutErrors.sort ( ( a, b ) => a.pathOffset.localeCompare ( b.pathOffset ) )
      for ( const root of rootsWithoutErrors ) {
        process.stdout.write ( `${root.catalogName}\n` )
        if ( content )
          process.stdout.write ( `${root.value}\n\n` )
      }
      displayErrors ( [ ...loaded, ...roots ] );
    } )
}

export interface DocsData {
  docsDir: string,
  dirExists: boolean,
  fileExists: boolean
}
async function findDocsData ( fileOps: FileOps,rootDir: string, dir: string ): Promise<DocsData> {
  const docsDir = path.join ( rootDir,dir, 'docs' )
  const mkdocs = path.join ( rootDir,dir, 'mkdocs.yml' )
  const dirExists = await fileOps.isDirectory ( docsDir )
  const fileExists = await fileOps.isFile ( mkdocs )
  return {  docsDir, dirExists, fileExists };
}
export function addDocsCommands ( context: CommandContext ) {
  context.command.command ( "docs" )
    .description ( "Scans for directories under the projects that are 'docs' and have the 'mkdoc.yaml' in them" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .action ( async ( opts ) => {
      const { fileTypes, debug, content, all, policy, template, name } = opts
      const fts = filterFileTypes ( context.fileTypes, opts.fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      console.log('Directory'.padEnd(maxFileLength), 'Dir'.padEnd(5), 'File'.padEnd(5))
      console.log(''.padEnd(maxFileLength, '-'), ''.padEnd(5, '-'), ''.padEnd(5, '-'))
      for ( const { file } of ffts ) {
        const { docsDir, dirExists, fileExists } = await findDocsData ( fileOps, dir,path.dirname ( file ) );
        console.log ( `${path.dirname(file).padEnd ( maxFileLength )} ${dirExists.toString ().padEnd ( 5 )} ${fileExists.toString ().padEnd ( 5 )}` )

      }
    } )
}
export function addDebugCommands ( context: CommandContext ) {
  const command: Command = context.command.command ( 'debug' ).description ( 'commands help resolve issues' )
  const newContext: CommandContext = { ...context, command }
  addArraysCommand ( newContext );
  addTreesCommands ( newContext );
  addDataCommand ( newContext );
  addFilesCommand ( newContext );
  addTemplateVarsCommand ( newContext );
  addListCommand ( newContext );
  addLocationsCommand ( newContext );
  addNukeCommand ( newContext );
  addDocsCommands ( newContext );
}