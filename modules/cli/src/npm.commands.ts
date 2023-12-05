import { CommandContext } from "./context";
import { Command } from "commander";
import { listNpmFilesAsModules, withJustLocalDeps } from "./npm";


export function addListNpmCommand ( context: CommandContext ) {
  context.command.command ( "list" )
    .description ( "list all modules" )
    .action ( async () => {
      const { command, fileOps, currentDirectory } = context
      const dir = command.optsWithGlobals ().directory ?? currentDirectory
      const modules = await listNpmFilesAsModules ( fileOps, dir )
      const longestModule = modules.reduce ( ( acc, md ) => Math.max ( acc, md.module.length ), 0 )
      const longestName = modules.reduce ( ( acc, md ) => Math.max ( acc, md.fullname?.length ?? 0 ), 0 )
      for ( const md of withJustLocalDeps(modules) ) {
        const ignore = md.ignore ? 'ignore' : '      '
        process.stdout.write( `${md.module.padEnd ( longestModule )} ${md.fullname?.padEnd ( longestName )} ${md.version}  ${ignore} ${md.deps.map ( md => md.fullname )}\n` )
      }
    } )
}


export function addNpmCommands ( context: CommandContext ) {
  const command: Command = context.command.command ( 'npm' ).description ( 'commands to scan package.json files' )
  const newContext: CommandContext = { ...context, command }
  addListNpmCommand ( newContext );
}