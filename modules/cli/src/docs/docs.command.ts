import { hasErrors, mapK } from "@laoban/utils";
import path from "path";
import { FileType, filterFileTypes, findFilesAndFileType, loadFiles, processFileResults } from "../filetypes/filetypes";
import { CommandContext } from "../context";
import { templateDir } from "../templates";
import { loadPolicy } from "../policy";
import { loadTemplateAndMakeLocationFiles } from "../locations";
import { displayErrors, ModuleData, ModuleDataWithoutErrors } from "../module";
import { FileOps } from "@laoban/fileops";
import * as fs from "fs";
import { Command } from "commander";
import { addRollupAllCommand, addRollUpProjectCommand } from "../rollup.commands";
import { fileExists } from "../file.search";
import { derefence, doubleXmlVariableDefn } from "@laoban/variables";
import { flatMapK } from "@laoban/utils/dist/src/utils";

export async function loadFilesAndFilesTypesForDisplay ( fileOps: FileOps, dir, fts: FileType[] ) {
  const ffts = await findFilesAndFileType ( fileOps, dir, fts )
  ffts.sort ( ( a, b ) => a.file.localeCompare ( b.file ) )
  const maxFileLength = ffts.reduce ( ( acc, { file } ) => Math.max ( acc, file.length ), 0 )
  const maxSourceType = ffts.reduce ( ( acc, { ft } ) => Math.max ( acc, ft.sourceType.length ), 0 )
  return { ffts, maxFileLength, maxSourceType };
}


export async function categoriseModuleForDocs ( fileOps: FileOps, rootDir: string, md: ModuleDataWithoutErrors ): Promise<string | undefined> {
  const dir = path.join ( rootDir, path.dirname ( md.pathOffset ) )
  if ( await fileExists ( fileOps, dir, 'mkdocs.yml' ) ) return 'mkdocs.yml'
  // if ( await fileExists ( dir, 'mkdocs.yaml' ) ) return 'mkdocs.yaml'
  if ( await fileExists ( fileOps, dir, 'README.md' ) ) return 'README.md'
  return undefined
}
export function addListDocs ( context: CommandContext ) {
  context.command.command ( "list" )
    .description ( "Lists the files that are either mkdocs.yml or a README.md that will be lifted into one" )
    .option ( 'p, --policy <policy>', 'policy url' )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( 'p, --policy <policy>', 'policy url' )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( '--dryrun', `Don't make the files, instead state what you would create` )
    .action ( async ( opts ) => {
      const { fileTypes, debug, policy } = opts
      const fts = filterFileTypes ( context.fileTypes, fileTypes )

      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, await loadPolicy ( fileOps, policy ), dir, ffts, debug )
      if ( debug ) console.log ( 'loaded', loaded )
      for ( const md of loaded ) {
        if ( hasErrors ( md ) ) console.log ( 'errors', md ); else {
          const cat = await categoriseModuleForDocs ( fileOps, dir, md )
          if ( cat )
            console.log ( path.join ( path.dirname ( md.catalogName ), cat ) )
        }
      }
    } )
}

export type FileAndContent = { file: string, content: string }
export const filesToCreate = ( fileOps: FileOps, dir: string, template: string ) => async ( md: ModuleData ): Promise<FileAndContent[]> => {
  if ( hasErrors ( md ) ) return []
  const cat = await categoriseModuleForDocs ( fileOps, dir, md )
  if ( cat === 'README.md' ) {
    const fullDir = path.join ( dir, path.dirname ( md.pathOffset ) )
    return [ {
      file: fileOps.join ( fullDir, 'mkdocs.yml' ),
      content: derefence ( `Making ${fullDir}`, {}, template, { variableDefn: doubleXmlVariableDefn, throwError: true } )
    },
      {
        file: fileOps.join ( fullDir, 'docs', 'README.md' ),
        content: await fileOps.loadFileOrUrl ( fileOps.join ( fullDir, 'README.md' ) )
      } ]
  }
  return []

};


export function addMakeDocs ( context: CommandContext ) {
  context.command.command ( "make" )
    .description ( "If we have a README.md without a mkdocs.yml in a place that has a software catalog we create a mkdocs and point it at the README.md" )
    .option ( 'p, --policy <policy>', 'policy url' )
    .option ( '-f, --fileTypes <fileTypes...>', 'comma separated list of file types to scan', [] )
    .option ( 'p, --policy <policy>', 'policy url' )
    .option ( '-d, --debug', 'output extra debugging' )
    .option ( '--dryrun', `Don't make the files, instead state what you would create` )
    .action ( async ( opts ) => {
      const { fileTypes, debug, policy, dryrun } = opts
      const fts = filterFileTypes ( context.fileTypes, fileTypes )

      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const { ffts } = await loadFilesAndFilesTypesForDisplay ( fileOps, dir, fts );
      const loaded = await loadFiles ( fileOps, await loadPolicy ( fileOps, policy ), dir, ffts, debug )
      if ( debug ) console.log ( 'loaded', loaded )
      const template = await fileOps.loadFileOrUrl ( templateDir + "/mkdocs.template.yml" )
      ;
      if ( debug ) console.log ( template )
      const ftc = filesToCreate ( fileOps, dir, template )
      const files: FileAndContent[] = await flatMapK ( loaded, ftc )
      if ( dryrun ) {
        console.log ( 'Files to create' )
        files.forEach ( f => console.log ( f.file ) )
        return
      }
    } )
}
export function addDocsCommands ( context: CommandContext ) {
  const command: Command = context.command.command ( 'docs' ).description ( 'commands to aggregate statistics' )
  const newContext: CommandContext = { ...context, command }
  addListDocs ( newContext );
  addMakeDocs ( newContext );
}