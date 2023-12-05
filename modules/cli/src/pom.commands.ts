import { CommandContext } from "./context";
import { Command } from "commander";
import path from "path";
import { extractPomDependencies, findAllChildPomDependencies, loadAndListPomModules, loadAndParsePom } from "./pom";
import * as util from "util";
import { isLocal, RawModuleData } from "./module";

export function addListModulesCommand ( context: CommandContext ) {
  context.command.command ( "list" )
    .description ( "list all modules" )
    .action ( async () => {
      const dir = context.command.optsWithGlobals ().directory ?? context.currentDirectory
      console.log ( await loadAndListPomModules ( context.fileOps, dir ) )
    } )
}

export function addDependencyCommand ( context: CommandContext ) {
  context.command.command ( "dep <module>" )
    .description ( "lists the dependencies for a single module (which must exist)" )
    .action ( async ( module ) => {
      const dir = context.command.optsWithGlobals ().directory ?? context.currentDirectory
      const moduleData = await loadAndListPomModules ( context.fileOps, dir );
      if ( !moduleData.modules.includes ( module ) ) throw new Error ( `module ${module} not found` )
      const moduleDir = path.resolve ( context.fileOps.join ( dir, module ) )
      const modulePom = await loadAndParsePom ( context.fileOps, moduleDir )
      console.log ( modulePom.modules )
    } )
}

export function addDependenciesCommand ( context: CommandContext ) {
  context.command.command ( "deps" )
    .description ( "lists the dependencies for all modules" )
    .option ( "--debug" )
    .action ( async ( opts ) => {
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const moduleData: RawModuleData = await loadAndListPomModules ( fileOps, dir );
      const result = await findAllChildPomDependencies ( fileOps, moduleData, dir, opts.debug );
      console.log ( util.inspect ( result, false, null ) )
    } )
}
export function addInternalDependencyCommand ( context: CommandContext ) {
  context.command.command ( "dep-int <module>" )
    .description ( "lists the internal dependencies for a single module" )
    .option ( "--debug" )
    .action ( async ( module, opts ) => {
      const dir = context.command.optsWithGlobals ().directory ?? context.currentDirectory
      const moduleData = await loadAndListPomModules ( context.fileOps, dir );
      if ( !moduleData.modules.includes ( module ) ) throw new Error ( `module ${module} not found` )
      const moduleDir = path.resolve ( context.fileOps.join ( dir, module ) )
      const modulePom = await loadAndParsePom ( context.fileOps, moduleDir )
      const deps = extractPomDependencies ( modulePom, opts.debug );
      const localDeps = deps.filter ( isLocal ( moduleData, opts.debug ) )
      console.log ( localDeps )
    } )
}
export function addPomCommands ( context: CommandContext ) {
  const command: Command = context.command.command ( 'pom' ).description ( 'commands to look at the maven pom' )
  const newContext: CommandContext = { ...context, command }
  addListModulesCommand ( newContext );
  addDependencyCommand ( newContext );
  addDependenciesCommand ( newContext );
  addInternalDependencyCommand ( newContext );
}