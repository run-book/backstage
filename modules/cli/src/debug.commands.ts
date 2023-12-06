import { CommandContext } from "./context";
import { Command } from "commander";
import { fileTypeFromMd, filterFileTypes, isModuleDependencyFileType, justModuleDependenciesForFtWithLocalDeps, loadFiles, makeDictionary } from "./filetypes/filetypes";
import { hasErrors } from "@laoban/utils";
import { displayErrors, isCatalogData, isModuleDependency, ModuleDependency } from "./module";
import { loadFilesAndFilesTypesForDisplay } from "./commands";


export function addDataCommand ( context: CommandContext ) {
  context.command.command ( "data" )
    .description ( "debugging - all the module data from the file - does not include data in parent" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( 'a|--all', 'include ignored files' )
    .option ( '-d, --debug', 'output extra debugging' )
    .action ( async ( opts ) => {
      const { fileTypes, debug, all } = opts
      const fts = filterFileTypes ( context.fileTypes, opts.fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, dir, ffts, debug )
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
    .option ( 'a|--all', 'include ignored files' )
    .action ( async ( opts ) => {
      const { fileTypes, debug, all } = opts
      const fts = filterFileTypes ( context.fileTypes, opts.fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, dir, ffts, debug )

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
// export function addTreesCommands ( context: CommandContext ) {
//   context.command.command ( "trees" )
//     .description ( "Shows the trees based just on the path" )
//     .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
//     .option ( '-d, --debug', 'output extra debugging' )
//     .option ( 'a|--all', 'include ignored files' )
//     .option ( '-o|--owner <owner>', 'owner of the component' )
//     .option ( '-l|--lifecycle  <lifecycle >', 'owner of the component, "experimental' )
//     .action ( async ( opts ) => {
//       const { fileTypes, debug, all, owner, lifecycle } = opts
//       const fts = filterFileTypes ( context.fileTypes, fileTypes )
//       if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
//       const { command, fileOps, currentDirectory } = context
//       const dir = command.optsWithGlobals ().directory ?? currentDirectory
//       const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
//       const loaded = await loadFiles ( fileOps, dir, ffts, debug )
//       const { trees, entityToMd } = justLocalDependencies ( loaded )
//       const roots = Object.values ( trees ).filter ( t => t.parent === undefined )
//       for ( const root of roots ) {
//         const treeString = treeToString ( root, debugStringForMd, 0 )
//         process.stdout.write ( `${treeString}\n` )
//       }
//       displayErrors ( loaded );
//     } )
// }

export function addTemplateVarsCommand ( context: CommandContext ) {
  context.command.command ( "vars" )
    .description ( "debugging - the variables available to templates" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( 'a|--all', 'include ignored files' )
    .option ( '-o|--owner <owner>', 'owner of the component' )
    .option ( '-l|--lifecycle  <lifecycle >', 'owner of the component, "experimental' )
    .action ( async ( opts ) => {
      const { fileTypes, debug, all, owner, lifecycle } = opts
      const fts = filterFileTypes ( context.fileTypes, fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, dir, ffts, debug )
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
export function addRawCommand ( context: CommandContext ) {
  context.command.command ( "raw" )
    .description ( "list all modules without any processing, or loading the files" )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .action ( async ( opts ) => {
      const { fileTypes, debug } = opts
      const fts = filterFileTypes ( context.fileTypes, opts.fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      for ( const { file, ft } of ffts ) {
        console.log ( file.padEnd ( maxFileLength ), ft.sourceType.padEnd ( maxSourceType ) )
      }
    } )
}
export function addListCommand ( context: CommandContext ) {
  context.command.command ( "list" )
    .description ( "list all modules." )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( 'a|--all', 'include ignored files' )
    .action ( async ( opts ) => {
      const { fileTypes, debug, all } = opts
      const fts = filterFileTypes ( context.fileTypes, opts.fileTypes )
      if ( debug ) console.log ( 'fileTypes', fts.map ( ft => ft.sourceType ) )
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts, maxFileLength, maxSourceType } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, dir, ffts, debug )
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
export function addDebugCommands ( context: CommandContext ) {
  const command: Command = context.command.command ( 'debug' ).description ( 'commands help resolve issues' )
  const newContext: CommandContext = { ...context, command }
  addRawCommand ( newContext );
  addArraysCommand ( newContext );
  // addTreesCommands ( newContext );
  addDataCommand ( newContext );
  addTemplateVarsCommand ( newContext );
  addListCommand ( newContext );
}