import { CommandContext } from "../context";
import { Command } from "commander";
import { addArraysCommand } from "../debug.commands";
import { defaultIgnoreFilter, scanDirectory } from "@laoban/fileops/dist/src/scan";
import * as yaml from 'js-yaml';
import path from "path";

export function addListCatalogsCommand ( context: CommandContext ) {
  const command: Command = context.command.command ( 'list-catalogs' ).description ( 'List all the catalogs' )
  command.action ( async ( opts ) => {
    const allopts = { ...opts, ...context.command.optsWithGlobals () }
    let { directory } = allopts
    directory = directory || context.currentDirectory
    const yamls = await scanDirectory ( context.fileOps, defaultIgnoreFilter ) ( directory, file => file.endsWith ( '.yaml' ) )
    for ( const y of yamls ) {
      const dir = path.relative(directory, y)
      const url = 'http://localhost:3010/' + dir.replace(/\\/g, '/')
      const contents = await context.fileOps.loadFileOrUrl ( y )
      try {
        const parsed: any = yaml.load ( contents )
        if ( parsed?.apiVersion ) console.log ( url ); else console.log ( url, 'is not a catalog' )
      } catch ( e ) {
        console.log ( url, 'is invalid yaml' )
      }
    }
  } )
}

export function addValidateCommands ( context: CommandContext ) {
  const command: Command = context.command.command ( 'debug' ).description ( 'commands help resolve issues' )
  const newContext: CommandContext = { ...context, command }
  addArraysCommand ( newContext );
}