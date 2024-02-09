import { CommandContext } from "./context";
import { FileOps, parseJson, withHeaders } from "@laoban/fileops";
import { flatMap, mapK, NameAnd } from "@laoban/utils";
import { derefence } from "@laoban/variables";
import { dollarsBracesVarDefn } from "@laoban/variables/dist/src/variables";


export interface ThingAndSecondDefn {
  thing: string,
  second: string,
  url?: string,
  error?: string
}
export interface HasLines {
  lines?: string
  error?: string
}
export interface DefnAndLines extends ThingAndSecondDefn, HasLines {

}
export interface ThingAndOwner<T> extends DefnAndLines {
  json: T
}
export const linesToDefn = ( context: string, pattern: string, dic: any, thingName: string ) => ( td: HasLines ): ThingAndSecondDefn[] => {
  const lines = td.lines.split ( '\n' ).map ( s => s.trim () ).filter ( s => s.length > 0 )
  return lines.map ( ( l, index ) => {
    const parts = l.split ( /\s+/g ).filter ( s => s.length > 0 )
    const newContext = `${context} line ${index} which is ${l}`;
    if ( parts.length !== 2 ) return { thing: newContext, second: '', error: `${context} ... expected 2 parts separated by whitespace  Got ${parts}` }
    const [ thing, second ] = parts
    const newDic = { ...dic, [ thingName ]: thing, owner: second };
    const url = derefence ( newContext, newDic, pattern, { variableDefn: dollarsBracesVarDefn } )
    return { thing, second, url }
  } );
};

export type Parser<T> = ( context: string ) => ( s: string ) => T
export const lineParser: Parser<string[]> = ( context: string ) => ( s: string ) => s.split ( '\n' ).map ( s => s.trim () ).filter ( s => s.length > 0 )

export const defnToThingK = <Res> ( fileOps: FileOps, parser: Parser<Res> ) => async ( defn: ThingAndSecondDefn ): Promise<ThingAndOwner<Res>> => {
  if ( defn.error ) return defn as ThingAndOwner<Res>
  const url = defn.url
  try {
    const lines = await fileOps.loadFileOrUrl ( url )
    return { ...defn, lines, json: parser ( url ) ( lines ) }
  } catch ( e ) {
    return { ...defn, error: `Error loading ${url} ${e}`, json: null }
  }
};

function reportAndReturn ( lines: any ) {
  if ( lines === undefined ) console.log ( 'undefined' )
  else if ( typeof lines === 'string' ) console.log ( lines )
  else if ( typeof lines === 'object' ) console.log ( JSON.stringify ( lines, null, 2 ) )
  else if ( Array.isArray ( lines ) ) console.log ( lines.join ( '\n' ) )
  else throw new Error ( `Cannot report ${lines}` )
}
export function addRollupCommand ( context: CommandContext ) {
  const fileOps = context.fileOps
  context.command.command ( "rollup [organisation] [project]  [path]" )
    .description ( "the file is a list of 'repo and whether it is enabled'. This will go get the stats for each line and roll them up" )
    .option ( "-t,--token_var <token-env-name>", "The environment variable holding the token", "SYSTEM_ACCESSTOKEN" )
    .option ( "-p,--projects-file <projectsFile>", "The file in the core repo that holds the list of projects", 'projects.txt' )
    .option ( "-r,--repos-file <reposFile>", "The file in the onboarded projects that holds the list of repos", 'repos.txt' )
    .option ( "-s,--stats-file <statsFile>", "The file in the onboarded repo that holds the stats", 'stats.txt' )
    .option ( '--backstage-pattern <projectPattern>', 'How we get the list of projects file. Allowed: ${organisation}' )
    .option ( '--project-pattern <projectPattern>', 'How we get the list of repos file. Allowed ${organisation} ${project}' )
    .option ( '--stats-pattern <statsPattern>', 'How we get the stat file. Allowed ${organisation} ${project} ${repo}' )
    .option ( '--listLines', 'Just list the lines in the DevHub list of projects' )
    .option ( '--listProjects', 'Just list the meta data about the DevHub list of projects' )
    .option ( '--listRepos', 'Lists repos files in the projects' )
    .option ( '--listStatFiles', 'Lists the stats files in the projects ' )
    .option ( '--listStats', 'Lists the stats in the projects ' )

    .action ( async ( organisation, project, repo, opts ) => {
        organisation = organisation || 'Day0-POCs'
        project = project || 'Backstage'
        repo = repo || 'DevHub'
        let { token_var, projectsFile, reposFile, statsFile, projectPattern, reposPattern, statsPattern } = opts
        const { listLines, listProjects, listRepos, listStatFiles, listStats } = opts
        projectPattern = projectPattern || 'https://dev.azure.com/${organisation}/${project}/_apis/git/repositories/${repo}/items?path=${projectsFile}&api-version=6.0'
        reposPattern = reposPattern || 'https://dev.azure.com/${organisation}/${project}/_apis/git/repositories/${repo}/items?path=${reposFile}&api-version=6.0'
        statsPattern = statsPattern || 'https://dev.azure.com/${organisation}/${project}/_apis/git/repositories/${repo}/items?path=${statsFile}&api-version=6.0'
        const token = process.env[ token_var ]
        const realFileOps = withHeaders ( context.fileOps, { Authorization: `Basic ${(btoa ( `:${token}` ))}` } )
        if ( token === undefined ) {
          console.log ( `You need to set the token environment variable ${token_var}` )
          return
        }
        const dic = { organisation, project, repo, projectsFile, reposFile, statsFile };
        const file = derefence ( `root file`, dic, projectPattern, { variableDefn: dollarsBracesVarDefn } )
        console.log ( 'file', file )
        console.log ( 'dic', dic )
        console.log ( 'projectPattern', projectPattern )
        async function loadLines () {
          try {
            return realFileOps.loadFileOrUrl ( file );
          } catch ( e ) {
            console.error ( `Error loading ${file} ${e}` )
            return ''
          }
        }
        const lines = await loadLines ()
        if ( listLines ) return reportAndReturn ( lines )

        const projectDefns = linesToDefn ( `Initial list of projects from ${file}`, reposPattern, dic, 'project' ) ( { lines } );
        if ( listProjects ) return reportAndReturn ( projectDefns )

        const projectTs = await mapK ( projectDefns, defnToThingK ( realFileOps, lineParser ) )
        // const projectTs = await mapK ( projectDefns, defnToThingK<any> ( realFileOps ) )
        if ( listRepos ) return reportAndReturn ( projectTs )
        const statDefns = flatMap<ThingAndOwner<string[]>, ThingAndSecondDefn> ( projectTs,
          p => linesToDefn ( `Project ${p.thing}`, statsPattern, { ...dic, project: p.thing }, 'repo' ) ( p ) )
        if ( listStatFiles ) return reportAndReturn ( statDefns )
        const filteredStateDefns = statDefns.filter ( sd => sd.second.toLowerCase () === 'true' )
        const statTs = await mapK<ThingAndSecondDefn, ThingAndOwner<any>> ( filteredStateDefns, defnToThingK ( realFileOps, parseJson<any> ) )
        if ( listStats ) return reportAndReturn ( statTs )

        const goodStatsTs = statTs.filter ( s => s.error === undefined && s.json !== null )
        const badStatsTs = statTs.filter ( s => s.error !== undefined || s.json === null )

        const result: NameAnd<NameAnd<any>> = {}
        goodStatsTs.forEach ( s => {
          const project = s.json.project;
          const projectJson = result[ project ] || {}
          const repo = s.json.repo
          if ( repo )
            projectJson[ repo ] = s.json
          else
            projectJson[ repo ] = { error: `No repo defined for ${JSON.stringify ( s )}` }
          result[ project ] = projectJson
        } )
        badStatsTs.forEach ( s => console.log ( JSON.stringify ( s, null, 2 ) ) )
        console.log ( JSON.stringify ( result, null, 2 ) )
      }
    )

}
