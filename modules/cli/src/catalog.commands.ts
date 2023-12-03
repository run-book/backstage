import { applyCatalogTemplate, applyRootCatalogTemplate, catalogTemplateDir, CommandContext, defaultCatalog, defaultRootCatalog, rootCatalogTemplateDir } from "./context";
import { Command } from "commander";
import { findAllDependencies } from "./pom.commands";
import { ModuleDependency } from "./pom";
import { FileOps, findChildDirsUnder } from "@laoban/fileops";

const searchDirectory = async ( fileOps: FileOps, dir: string, allFiles: string[] ) => {
  const files = await fileOps.listFiles ( dir );

  await Promise.all ( files.map ( async file => {
    const filepath = fileOps.join ( dir, file );
    if ( await fileOps.isDirectory ( filepath ) ) {
      await searchDirectory ( fileOps, filepath, allFiles );
    } else if ( file === 'backstage.service.yaml' ) {
      allFiles.push ( filepath );
    }
  } ) );
};
export function addFindServicesCommand ( context: CommandContext ) {
  context.command.command ( "services" )
    .description ( "finds the services in the repo" )
    .option ( '--debug' )
    .action ( async ( opts ) => {
      const { command, fileOps, currentDirectory, gitstore } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      let dirs: string[] = []
      await searchDirectory ( fileOps, dir, dirs );
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
      let dirs: string[] = []
      await searchDirectory ( fileOps, dir, dirs );
      const relativeDirs = dirs.map ( d => './' + fileOps.relative ( dir, d ).replace(/\\/g, '/') )

      const repo = await gitstore.currentRepo ( dir )
      const name = opts.name ?? `Mono repo at ${repo}`
      const modData: ModuleDependency[] = await findAllDependencies ( fileOps, dir, debug );
      const rootCatalogDir = rootCatalogTemplateDir ( name, modData, relativeDirs )
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
  addFindServicesCommand ( newContext );
}