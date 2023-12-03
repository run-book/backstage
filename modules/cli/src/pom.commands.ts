import { CommandContext } from "./context";
import { Command } from "commander";
import path from "path";
import { FileOps } from "@laoban/fileops";
import { extractDependencies, isLocal, loadAndListModules, loadAndParse, ModuleDependency } from "./pom";
import * as util from "util";
import { debug } from "util";

export function addListModulesCommand ( context: CommandContext ) {
  context.command.command ( "list" )
    .description ( "list all modules" )
    .action ( async () => {
      const dir = context.command.optsWithGlobals ().directory ?? context.currentDirectory
      console.log ( await loadAndListModules ( context.fileOps, dir ) )
    } )
}

export function addDependencyCommand ( context: CommandContext ) {
  context.command.command ( "dep <module>" )
    .description ( "lists the dependencies for a single module (which must exist)" )
    .action ( async ( module ) => {
      const dir = context.command.optsWithGlobals ().directory ?? context.currentDirectory
      const moduleData = await loadAndListModules ( context.fileOps, dir );
      if ( !moduleData.modules.includes ( module ) ) throw new Error ( `module ${module} not found` )
      const moduleDir = path.resolve ( context.fileOps.join ( dir, module ) )
      const modulePom = await loadAndParse ( context.fileOps, moduleDir )
      console.log ( modulePom.modules )
    } )
}
export async function findAllDependencies ( fileOps: FileOps, dir: string, debug: boolean ): Promise<ModuleDependency[]> {
  const moduleData = await loadAndListModules ( fileOps, dir );
  const { groupId, modules } = moduleData;
  if ( debug ) console.log ( `groupId ${groupId} modules ${modules}` )
  const mods: ModuleDependency[] = await Promise.all ( modules.map ( async module => {
    const moduleDir = path.resolve ( fileOps.join ( dir, module ) )
    if (debug)console.log(`moduleDir ${moduleDir}`)
    const modulePom = await loadAndParse ( fileOps, moduleDir )
    const allDeps = extractDependencies ( modulePom, debug );
    if ( debug ) console.log ( `   allDeps for ${module}`, allDeps )
    const description = modulePom.project.description
    const deps = allDeps.filter ( isLocal ( moduleData, debug ) )
    return { module, groupId, artifactId: module, deps, description }
  } ) )
  return mods;
}
export function addDependenciesCommand ( context: CommandContext ) {
  context.command.command ( "deps" )
    .description ( "lists the dependencies for all modules" )
    .option ( "--debug" )
    .action ( async ( opts ) => {
      const dir = context.command.optsWithGlobals ().directory ?? context.currentDirectory
      const result = await findAllDependencies ( context.fileOps, dir, opts.debug );
      console.log ( util.inspect ( result, false, null ) )
    } )
}
export function addInternalDependencyCommand ( context: CommandContext ) {
  context.command.command ( "dep-int <module>" )
    .description ( "lists the internal dependencies for a single module" )
    .option( "--debug")
    .action ( async ( module , opts) => {
      const dir = context.command.optsWithGlobals ().directory ?? context.currentDirectory
      const moduleData = await loadAndListModules ( context.fileOps, dir );
      if ( !moduleData.modules.includes ( module ) ) throw new Error ( `module ${module} not found` )
      const moduleDir = path.resolve ( context.fileOps.join ( dir, module ) )
      const modulePom = await loadAndParse ( context.fileOps, moduleDir )
      const deps = extractDependencies ( modulePom, opts.debug );
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