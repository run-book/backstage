import { applyTemplate, catalogTemplateDir, CommandContext, defaultCatalog } from "./context";
import { Command } from "commander";
import { findAllDependencies } from "./pom.commands";
import { ModuleDependency } from "./pom";

export function addMakeCatalogCommand ( context: CommandContext ) {
  context.command.command ( "make" )
    .description ( "makes the catalog entries" )
    .option ( '--dryrun', 'Just print what would happen' )
    .option ( '-o|--owner <owner>', 'owner of the catalog', 'Not Known' )
    .option ( '-l|--lifecycle <lifecycle>', 'lifecycle of the catalog', 'experimental' )
    .action ( async ( opts ) => {
      const { owner, lifecycle, dryrun } = opts
      const { command, fileOps, currentDirectory,gitstore } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const repo= await gitstore.currentRepo(dir)
      const modData: ModuleDependency[] = await findAllDependencies ( fileOps, dir );
      await Promise.all ( modData.map ( async md => {
        const catalogDir = catalogTemplateDir ( owner, md, repo, lifecycle )
        const template = defaultCatalog
        const catalog = applyTemplate ( catalogDir, template )
        const filename = fileOps.join ( dir, md.module, `catalog-info.yaml` )
        if ( dryrun ) {
          console.log ( 'filename', filename )
          console.log ( catalog )
          console.log ()
        } else
          await fileOps.saveFile ( filename, catalog )
      } ) )
    } )
}

export function addCatalogCommands ( context: CommandContext ) {
  const command: Command = context.command.command ( 'catalog' ).description ( 'commands to setup backstage catalogs' )
  const newContext: CommandContext = { ...context, command }
  addMakeCatalogCommand ( newContext );
}