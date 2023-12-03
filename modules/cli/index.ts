#!/usr/bin/env node

import { Command } from "commander";
import { fileOpsNode } from "@laoban/filesops-node";
import { addPomCommands } from "./src/pom.commands";
import { FileOps } from "@laoban/fileops";
import { CommandContext } from "./src/context";
import { addCatalogCommands } from "./src/catalog.commands";
import { execute, GithubStore } from "./src/gitstore";

const fetch = require ( 'node-fetch' );

export function findVersion () {
  let packageJsonFileName = "../package.json";
  try {
    return require ( packageJsonFileName ).version
  } catch ( e ) {
    return "version not known"
  }
}


const program: Command = require ( 'commander' )
  .name ( 'backstage' )
  .usage ( '<command> [options]' )
  .version ( findVersion () )
  .option ( '-d|--directory <directory>', "directory to work in" )


const fileOps: FileOps = fileOpsNode ()
const gitstore = GithubStore ( fetch, execute, process.env.GITHUB_TOKEN )
const context: CommandContext = { command: program, fileOps, gitstore, currentDirectory: process.cwd () }
addPomCommands ( context )
addCatalogCommands ( context )
program.command ( "debug" ).description ( "just lists the flags you selected" ).action ( () => {
  console.log ( program.optsWithGlobals () )
} )

const parsed = program.parseAsync ( process.argv );
