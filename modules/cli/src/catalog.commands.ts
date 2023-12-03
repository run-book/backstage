import { applyCatalogTemplate, applyRootCatalogTemplate, catalogTemplateDir, CommandContext, defaultCatalog, defaultRootCatalog, rootCatalogTemplateDir } from "./context";
import { Command } from "commander";
import { findAllDependencies } from "./pom.commands";
import { ModuleDependency } from "./pom";

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
      const repo = await gitstore.currentRepo ( dir )
      const name = opts.name ?? `Mono repo at ${repo}`
      const modData: ModuleDependency[] = await findAllDependencies ( fileOps, dir, debug );
      const rootCatalogDir = rootCatalogTemplateDir ( name, modData )
      const rootCatalog = applyRootCatalogTemplate ( rootCatalogDir, defaultRootCatalog )


      await Promise.all ( modData.map ( async md => {
        const catalogDir = catalogTemplateDir ( owner, md, repo, lifecycle )
        const template = defaultCatalog
        const catalog = applyCatalogTemplate ( catalogDir, template )
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
}