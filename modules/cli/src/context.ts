import { Command } from "commander";
import { FileOps } from "@laoban/fileops";
import { FileType } from "./filetypes/filetypes";


export interface CommandContext {
  command: Command
  fileOps: FileOps
  currentDirectory: string
  fileTypes: FileType[]
}


