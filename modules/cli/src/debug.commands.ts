import { CommandContext } from "./context";
import { Command } from "commander";
import { fileTypeFromMd, filterFileTypes, isModuleDependencyFileType, justModuleDependenciesForFtWithLocalDeps, loadFiles, makeDictionary } from "./filetypes/filetypes";
import { hasErrors } from "@laoban/utils";
import { CatalogData, debugStringForMd, displayErrors, isCatalogData, isModuleDependency, ModuleData, moduleDataPath, ModuleDataWithoutErrors } from "./module";
import { loadFilesAndFilesTypesForDisplay } from "./commands";
import { makeTreeFromPathFnAndArray, treeToString } from "./tree";
import { loadPolicy } from "./policy";
import { loadTemplateAndMakeLocationFiles, makeLocationFiles } from "./locations";
import { templateDir } from "./templates";


export function addDataCommand ( context: CommandContext ) {
  context.command.command ( "data" )
    .description ( "debugging - all the module data from the file - does not include data in parent" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( 'a|--all', 'include ignored files' )
    .option ( 'p|--policy <policy>', 'policy url' )
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
    .option ( 'a|--all', 'include ignored files' )
    .option ( 'p|--policy <policy>', 'policy url' )
    .option ( '-o|--owner <owner>', 'owner of the component' )
    .option ( '-l|--lifecycle  <lifecycle >', 'owner of the component, "experimental' )
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
    .option ( 'p|--policy <policy>', 'policy url' )
    .option ( '-o|--owner <owner>', 'owner of the component' )
    .option ( '-l|--lifecycle  <lifecycle >', 'owner of the component, "experimental' )
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
    .description ( "shows all the places files will be added" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( 'a|--all', 'include ignored files' )
    .option ( 'p|--policy <policy>', 'policy url' )
    .action ( async ( opts ) => {
      const { fileTypes, debug, policy, all } = opts
      const fts = filterFileTypes ( context.fileTypes, opts.fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const mds = await loadFiles ( fileOps, await loadPolicy ( fileOps, policy ), dir, ffts, debug )
      for ( const md of mds ) {
        if ( hasErrors ( md ) ) continue
        if ( md.ignore && !all ) continue
        const ignore = all ? (md.ignore ? ' ignore' : '       ') : ''
        process.stdout.write ( `${md.catalogName.padEnd ( maxFileLength )} ${md.sourceType.padEnd ( maxSourceType )}${ignore} from ${md.pathOffset}\n` )
      }
      displayErrors ( mds );
    } )
}

export function addListCommand ( context: CommandContext ) {
  context.command.command ( "list" )
    .description ( "list all modules." )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( 'a|--all', 'include ignored files' )
    .option ( 'p|--policy <policy>', 'policy url' )
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
export function addLocationsCommand ( context: CommandContext ) {
  context.command.command ( "locations" )
    .description ( "show all the places that location files will be added, and optionally their content" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( "--content", "show the content of the location files" )
    .option ( "-n|--name <name>", "A name is needed for the locations files. This can be provided from package.json, or pom.xml. But otherwise this is needed" )
    .option ( 'p|--policy <policy>', 'policy url' )
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
}