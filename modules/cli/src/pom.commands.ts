import { CommandContext } from "./context";
import { Command } from "commander";
import path from "path";
import { FileOps } from "@laoban/fileops";
import { extractDependencies, isLocal, loadAndListModules, loadAndParse, ModuleDependency } from "./pom";
import * as util from "util";

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
export async function findAllDependencies ( fileOps: FileOps, dir ): Promise<ModuleDependency[]> {
  const moduleData = await loadAndListModules ( fileOps, dir );
  const { groupId, modules } = moduleData;
  const mods: ModuleDependency[] = await Promise.all ( modules.map ( async module => {
    const moduleDir = path.resolve ( fileOps.join ( dir, module ) )
    const modulePom = await loadAndParse ( fileOps, moduleDir )
    const allDeps = extractDependencies ( modulePom );
    const description = modulePom.project.description
    const deps = allDeps.filter ( isLocal ( moduleData ) )
    return { module, groupId, artifactId: module, deps, description }
  } ) )
  return mods;
}
export function addDependenciesCommand ( context: CommandContext ) {
  context.command.command ( "deps" )
    .description ( "lists the dependencies for all modules" )
    .action ( async () => {
      const dir = context.command.optsWithGlobals ().directory ?? context.currentDirectory
      const result = await findAllDependencies ( context.fileOps, dir );
      console.log ( util.inspect ( result, false, null ) )
    } )
}
export function addInternalDependencyCommand ( context: CommandContext ) {
  context.command.command ( "dep-int <module>" )
    .description ( "lists the internal dependencies for a single module" )
    .action ( async ( module ) => {
      const dir = context.command.optsWithGlobals ().directory ?? context.currentDirectory
      const moduleData = await loadAndListModules ( context.fileOps, dir );
      if ( !moduleData.modules.includes ( module ) ) throw new Error ( `module ${module} not found` )
      const moduleDir = path.resolve ( context.fileOps.join ( dir, module ) )
      const modulePom = await loadAndParse ( context.fileOps, moduleDir )
      const deps = extractDependencies ( modulePom );
      const localDeps = deps.filter ( isLocal ( moduleData ) )
      console.log ( localDeps )
    } )
}
export function addPomCommands ( context: CommandContext ) {
  const command: Command = context.command.command ( 'pom' ).description ( 'commands to setup git repos for the students taking the course' )
  const newContext: CommandContext = { ...context, command }
  addListModulesCommand ( newContext );
  addDependencyCommand ( newContext );
  addDependenciesCommand ( newContext );
  addInternalDependencyCommand ( newContext );
}