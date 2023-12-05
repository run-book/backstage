import { CommandContext } from "./context";
import { Command } from "commander";
import { FileType, fileTypeFromMd, filterFileTypes, findFilesAndFileType, loadFiles, makeDictionary, mdsToFileResults } from "./filetypes/filetypes";
import { hasErrors } from "@laoban/utils";
import { displayErrors, isCatalogData, isModuleDependency, ModuleData } from "./module";
import { FileOps } from "@laoban/fileops";
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
      const { pathToMd, entityToMd } = mdsToFileResults ( loaded )
      loaded.forEach ( md => {
        if ( hasErrors ( md ) ) return
        if ( md.ignore && !all ) return
        const ft = fileTypeFromMd ( fts, md );
        const makeArray = ft.makeArray ( pathToMd, entityToMd );
        const array = makeArray ( md )
        const arrayString = array.map ( md => hasErrors ( md ) ? '' : md.pathOffset.padEnd ( maxFileLength ) ).join ( ' ' )
        process.stdout.write ( `${md.pathOffset.padEnd ( maxFileLength )} ${md.sourceType.padEnd ( maxSourceType )} [${array.length}]  ${arrayString}\n` )
      } )
      displayErrors ( loaded );
    } )
}
export function addTemplateVarsCommand ( context: CommandContext ) {
  context.command.command ( "template-debug" )
    .description ( "debugging" )
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
      const { pathToMd, entityToMd } = mdsToFileResults ( loaded )
      loaded.forEach ( md => {
        if ( hasErrors ( md ) ) return
        if ( md.ignore && !all ) return
        const ft = fileTypeFromMd ( fts, md );
        const makeArray = ft.makeArray ( pathToMd, entityToMd );
        const array = makeArray ( md )
        const dic = makeDictionary ( { owner, lifecycle }, array )
        process.stdout.write ( `${md.pathOffset.padEnd ( maxFileLength )} ${md.sourceType.padEnd ( maxSourceType )} ${JSON.stringify ( dic )}\n` )
      } )
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
  addDataCommand ( newContext );
  addTemplateVarsCommand ( newContext );
  addListCommand ( newContext );
}