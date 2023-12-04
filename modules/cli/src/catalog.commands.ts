import { applyCatalogTemplateForKind, applyRootCatalogTemplate, catalogTemplateDic, CommandContext, rootCatalogTemplateDictionary, templateDir } from "./context";
import { Command } from "commander";
import { findAllDependencies, ModuleDependency } from "./pom";
import { FileAndKind, searchDirectory } from "./file.search";


export function addFindCommand ( context: CommandContext ) {
  context.command.command ( "find" )
    .description ( "finds the files 'backstage.xxx.yaml in the repo" )
    .option ( '--debug' )
    .action ( async ( opts ) => {
      const { command, fileOps, currentDirectory, gitstore } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      let dirs: FileAndKind[] = await searchDirectory ( fileOps, dir );
      dirs.forEach ( dir => console.log ( dir ) )
    } )

}
export function addMakeCatalogCommand ( context: CommandContext ) {
  context.command.command ( "make" )
    .description ( "makes the catalog entries" )
    .option ( '--dryrun', 'Just print what would happen' )
    .option ( '-o|--owner <owner>', 'owner of the catalog', 'Not Known' )
    .option ( '-l|--lifecycle <lifecycle>', 'lifecycle of the catalog', 'experimental' )
    .option ( '-n|--name <name>', 'name of the root componment', )
    .option ( '--debug' )
    .action ( async ( opts ) => {
      const { owner, lifecycle, dryrun, debug } = opts
      const { command, fileOps, currentDirectory, gitstore } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      let dirs: FileAndKind[] = await searchDirectory ( fileOps, dir );
      const relativeDirs = dirs.map ( d => './' + fileOps.relative ( dir, d.file ).replace ( /\\/g, '/' ) )

      const repo = await gitstore.currentRepo ( dir )
      const name = opts.name ?? `Mono repo at ${repo}`
      const modData: ModuleDependency[] = await findAllDependencies ( fileOps, dir, debug );
      const rootCatalogDic = rootCatalogTemplateDictionary ( name, modData, relativeDirs )
      const rootCatalog = await applyRootCatalogTemplate ( fileOps, templateDir, rootCatalogDic )


      await Promise.all ( modData.map ( async md => {
        const catalogDic = catalogTemplateDic ( owner, md, repo, lifecycle )

        const catalog = await applyCatalogTemplateForKind ( fileOps, templateDir, md.kind, catalogDic )
        const filename = fileOps.join ( dir, md.module, `catalog-info.yaml` )
        if ( dryrun ) {
          console.log ( 'filename', filename )
          console.log ( catalog )
          console.log ()
        } else
          await fileOps.saveFile ( filename, catalog )
      } ) )
      if ( dryrun ) {
        console.log ( 'filename', fileOps.join ( dir, `catalog-info.yaml` ) )
        console.log ( rootCatalog )
        console.log ()
      } else
        await fileOps.saveFile ( fileOps.join ( dir, `catalog-info.yaml` ), rootCatalog )
    } )
}

export function addCatalogCommands ( context: CommandContext ) {
  const command: Command = context.command.command ( 'catalog' ).description ( 'commands to setup backstage catalogs' )
  const newContext: CommandContext = { ...context, command }
  addMakeCatalogCommand ( newContext );
  addFindCommand ( newContext );
}