import { Command } from "commander";
import { FileOps } from "@laoban/fileops";
import { FileType } from "./filetypes/filetypes";


export interface CommandContext {
  command: Command
  fetch: ( url: string, init?: RequestInit ) => Promise<Response>
  fileOps: FileOps
  currentDirectory: string
  fileTypes: FileType[]
}


