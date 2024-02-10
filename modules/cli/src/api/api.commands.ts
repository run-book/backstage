import { CommandContext } from "../context";
import { startKoa } from "@runbook/koa";

export function addFileApiCommand ( context: CommandContext ) {
  context.command.command ( "fileapi" )
    .description ( "Launches a file system api. The purpose for this is to allow the --dryrun option on posting locations to validate catalog-info.yamls. " )
    .option ( '--port <port>', 'Will run on this port', "3010" )
    .option ( '--debug', 'some debugging when running the fileApi' )
    .action ( async ( opts ) => {
      const fullOpts: any = { ...opts, ...context.command.optsWithGlobals () }
      const { port, debug, directory } = fullOpts
      startKoa ( directory || context.currentDirectory, Number.parseInt ( port ), debug )
    } )
}