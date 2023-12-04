import { Command } from "commander";
import { FileOps } from "@laoban/fileops";


export interface CommandContext {
  command: Command
  fileOps: FileOps
  currentDirectory: string
}


