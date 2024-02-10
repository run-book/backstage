#!/usr/bin/env node

import { Command } from "commander";
import { fileOpsNode } from "@laoban/filesops-node";
import { FileOps } from "@laoban/fileops";
import { CommandContext } from "./src/context";
import { alLFileTypes } from "./src/filetypes/allFileTypes";
import { addDebugCommands } from "./src/debug.commands";
import { addMakeCommands } from "./src/make.commands";
import { addSummariseCommand } from "./src/summarise.commands";
import { addRollupCommands } from "./src/rollup.commands";
import { addFileApiCommand } from "./src/api/api.commands";
import { addListCatalogsCommand } from "./src/validate/validation.commands";

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
const context: CommandContext = { command: program, fileOps, currentDirectory: process.cwd (), fileTypes: alLFileTypes }
addDebugCommands ( context )
addMakeCommands ( context )
addSummariseCommand ( context )
addRollupCommands ( context )
addFileApiCommand ( context )
addListCatalogsCommand ( context )

const parsed = program.parseAsync ( process.argv );
