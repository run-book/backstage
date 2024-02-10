import { CommandContext } from "./context";
import { HasErrors } from "./error.monad";
import { NameAnd } from "@laoban/utils";
import { HasUrl, LinesAndJsonAnd } from "./azure/lines.and";
import { parsePairOnLine, Parser } from "./azure/parser";
import { azureDetails, walkAllRepoAndEnabled, walkAllStateDefns, walkAllStateDefnsFromProject, walkAllStats, walkAllStatsFromProject, walkProjectDefns, walkProjectDefnsFromProject } from "./azure/azure.domain";
import { Command } from "commander";


export interface ProjectDefn extends HasUrl, ProjectAndOwner {
}
export interface RepoDefn extends ProjectDefn {
  repo: string
}

export type ProjectAndOwner = { project: string, owner: string } & HasErrors
export type RepoAndEnabled = { repo: string, enabled: string } & HasErrors

export const pairToProjectAndOwner = ( one: string, two: string ): ProjectAndOwner => ({ project: one, owner: two });
export const pairToRepoAndEnabled = ( one: string, two: string ): RepoAndEnabled => ({ repo: one, enabled: two });


export const parserProjectAndOwner: Parser<ProjectAndOwner[]> = parsePairOnLine ( pairToProjectAndOwner )
export const parserRepoAndEnabled: Parser<RepoAndEnabled[]> = parsePairOnLine ( pairToRepoAndEnabled )


function reportAndReturn ( lines: any ) {
  if ( lines === undefined ) console.log ( 'undefined' )
  else if ( typeof lines === 'string' ) console.log ( lines )
  else if ( typeof lines === 'object' ) console.log ( JSON.stringify ( lines, null, 2 ) )
  else if ( Array.isArray ( lines ) ) console.log ( lines.map ( reportAndReturn ).join ( '\n' ) )
  else throw new Error ( `Cannot report ${lines}` )
}

export function addAzureOptions ( command: Command ) {
  return command.option ( "-t,--token_var <token-env-name>", "The environment variable holding the token", "SYSTEM_ACCESSTOKEN" )
    .option ( "-o, --organisation <organisation>", "The azure devops organisation" )
    .option ( "--projects-file <projectsFile>", "The file in the core repo that holds the list of projects", 'projects.txt' )
    .option ( "-r,--repos-file <reposFile>", "The file in the onboarded projects that holds the list of repos", 'repos.txt' )
    .option ( "-s,--stats-file <statsFile>", "The file in the onboarded repo that holds the stats", 'stats.txt' )
    .option ( '--backstage-pattern <projectPattern>', 'How we get the list of projects file. Allowed: ${organisation}' )
    .option ( '--project-pattern <projectPattern>', 'How we get the list of repos file. Allowed ${organisation} ${project}' )
    .option ( '--stats-pattern <statsPattern>', 'How we get the stat file. Allowed ${organisation} ${project} ${repo}' )
}

export function addRollUpProjectCommand ( context: CommandContext ) {
  const fileOps = context.fileOps
  addAzureOptions ( context.command.command ( "project [project]" ).description ( "Gathers all stats from every repo in a single project." ) )
    .option ( '--listRepos', 'Lists project/enabled in the project' )
    .option ( '--listStatFiles', 'Lists the stats files in the projects ' )
    .option ( '--listStats', 'Lists the stats in the projects ' )
    .action ( async ( project, opts ) => {
      const { listRepos, listStatFiles, listStats } = opts
      const azure = azureDetails ( context.fileOps, opts, process.env, project )
      if ( listRepos ) return reportAndReturn ( await walkProjectDefnsFromProject ( azure, project ) )
      if ( listStatFiles ) return reportAndReturn ( await walkAllStateDefnsFromProject ( azure, project ) )
      const sds: LinesAndJsonAnd<RepoDefn, any>[] = await walkAllStatsFromProject ( azure, project );
      if ( listStats ) return reportAndReturn ( sds )
      const data: NameAnd<any> = {}
      sds.forEach ( rd => data[ rd.repo ] = rd.json )
      const errors = sds.filter ( s => s.error !== undefined )
        .map ( ( error, errorContext ) => ({ error, errorContext }) )
      const result = { good: data, errors }
      console.log ( JSON.stringify ( result, null, 2 ) )
    } )
}
export function addRollupAllCommand ( context: CommandContext ) {
  const fileOps = context.fileOps
  addAzureOptions ( context.command.command ( "all " ).description ( "Gathers all stats from every project and repo." ) )
    .option ( "-p, --project <project>", "The azure devops root project " )
    .option ( '--listProjects', 'Debug: list the projects and owners and url of the repos file in those projects' )
    .option ( '--listRepos', 'Lists project/owner/repo and project/enabled in the projects' )
    .option ( '--listStatFiles', 'Lists the stats files in the projects ' )
    .option ( '--listStats', 'Lists the stats in the projects ' )
    .action ( async ( opts ) => {
      const { listProjects, listRepos, listStatFiles, listStats } = opts
      const azure = azureDetails ( context.fileOps, opts, process.env )
      if ( listProjects ) return reportAndReturn ( await walkProjectDefns ( azure ) )
      if ( listRepos ) return reportAndReturn ( await walkAllRepoAndEnabled ( azure ) )
      if ( listStatFiles ) return reportAndReturn ( await walkAllStateDefns ( azure ) )
      const sds: LinesAndJsonAnd<RepoDefn, any>[] = await walkAllStats ( azure );
      if ( listStats ) return reportAndReturn ( sds )

      const data: NameAnd<NameAnd<any>> = {}
      sds.forEach ( rd => {
        const project = rd.project;
        const projectJson = data[ project ] || {}
        projectJson[ rd.repo ] = rd.json
        data[ project ] = projectJson
      } )
      const errors = sds.filter ( s => s.error !== undefined )
        .map ( ( error, errorContext ) => ({ error, errorContext }) )
      const result = { good: data, errors }
      console.log ( JSON.stringify ( result, null, 2 ) )
    } )
}
export function addRollupCommands ( context: CommandContext ) {
  const command: Command = context.command.command ( 'rollup' ).description ( 'commands to aggregate statistics' )
  const newContext: CommandContext = { ...context, command }
  addRollupAllCommand ( newContext );
  addRollUpProjectCommand ( newContext );
}