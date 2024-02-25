import { NameAnd } from "@laoban/utils";
import { FileOps, withHeaders } from "@laoban/fileops";
import { derefence, dollarsBracesVarDefn } from "@laoban/variables";
import { fetchLinesAndParse, HasUrl, LinesAndJsonAnd, mapLinesAndJsonAnd } from "./lines.and";
import { parseProjectAndOwnerFromJSON, parseProjectAndOwnerFromLines, parseRepoAndEnabledFromJSON, parseRepoAndEnabledFromLines, ProjectAndOwner, ProjectDefn, RepoAndEnabled, RepoDefn } from "../rollup.commands";
import { flatMapErrorsListK, mapErrorsListK } from "../error.monad";
import { jsonParser, Parser } from "./parser";

export interface AzureDetails {
  organisation: string
  project: string
  rootRepo: string
  projectRootRepo: string
  statsRepoPattern: string
  projectsFile: string
  reposFile: string
  statsFile: string
  projectPattern: string
  reposPattern: string
  statsPattern: string
  fileOps: FileOps
  dic: any
  debug: boolean
  parseProjectAndOwner: Parser<ProjectAndOwner[]>
  parseRepoAndEnabled: Parser<RepoAndEnabled[]>
}

export function findParsers ( useJson: boolean ) {
  return useJson ?
    { parseProjectAndOwner: parseProjectAndOwnerFromJSON, parseRepoAndEnabled: parseRepoAndEnabledFromJSON } :
    { parseProjectAndOwner: parseProjectAndOwnerFromLines, parseRepoAndEnabled: parseRepoAndEnabledFromLines }
}

export function azureDetails ( fileOps: FileOps, opts: any, env: NameAnd<string>, project?: string ): AzureDetails {
  const parsers = findParsers ( opts.jsonParser || env.AZURE_JSON_PARSER === 'true' || false )
  const organisation = opts.organisation || env.AZURE_ORG || 'Day0-POCs';
  project = project || opts.project || env.AZURE_PROJECT || 'Backstage';
  const tokenVar = opts.token_var || "SYSTEM_ACCESSTOKEN";
  const token = env[ tokenVar ]
  if ( !token ) throw new Error ( `Environment variable for azure PAT token [${tokenVar}] not present` )
  const realFileOps = withHeaders ( fileOps, { Authorization: `Basic ${(btoa ( `:${token}` ))}` } )
  const rootRepo = opts.rootRepo || env.AZURE__ROOT_REPO || 'DevHub'
  const projectRootRepo = opts.projectRootRepo || env.AZURE_PROJECT_REPO || 'DevHub'
  const statsRepoPattern = opts.statsRepoPattern || env.AZURE_STATS_REPO_PATTERN || '${repo}'
  const projectsFile = opts.projectsFile || env.AZURE_PROJECTS_FILE || 'projects.txt';
  const reposFile = opts.reposFile || env.AZURE_REPOS_FILE || 'repos.txt';
  const statsFile = opts.statsFile || env.AZURE_STATS_FILE || 'stats.txt';
  const dic = { organisation, project, rootRepo, projectRootRepo, projectsFile, reposFile, statsFile };
  const debug = opts.debug
  const result: AzureDetails = {
    debug,
    fileOps: realFileOps,
    dic,
    organisation: organisation,
    project,
    rootRepo,
    projectRootRepo,
    statsRepoPattern,
    projectsFile,
    reposFile,
    statsFile,
    projectPattern: opts.projectPattern || env.AZURE_PROJECT_PATTERN || 'https://dev.azure.com/${organisation}/${project}/_apis/git/repositories/${rootRepo}/items?path=${projectsFile}&api-version=6.0',
    reposPattern: opts.reposPattern || env.AZURE_REPOS_PATTERN || 'https://dev.azure.com/${organisation}/${project}/_apis/git/repositories/${projectRootRepo}/items?path=${reposFile}&api-version=6.0',
    statsPattern: opts.statsPattern || env.AZURE_STATS_PATTERN || 'https://dev.azure.com/${organisation}/${project}/_apis/git/repositories/' + statsRepoPattern + '/items?path=${statsFile}&api-version=6.0',
    ...parsers
  };
  if ( debug ) console.log ( `AzureDetails: ${JSON.stringify ( result, null, 2 )}` )
  return result
}

export function rootFile ( azure: AzureDetails ) {
  return derefence ( `root file`, azure.dic, azure.projectPattern, { variableDefn: dollarsBracesVarDefn } )
}

const makeProjectDefn = ( azure: AzureDetails ) => ( defn: HasUrl, line: ProjectAndOwner ) => {
  const dic = { ...azure.dic, ...line };
  const url = derefence ( `repos file`, dic, azure.reposPattern, { variableDefn: dollarsBracesVarDefn } )
  if ( azure.debug ) console.log ( 'projectDefn url', url, 'dic', JSON.stringify ( dic, null, 2 ) );
  return { ...defn, ...line, url, json: undefined, lines: undefined }
};
export const projectListToProjectDefns = ( azure: AzureDetails ) => async ( pl: LinesAndJsonAnd<HasUrl, ProjectAndOwner[]> ): Promise<ProjectDefn[]> => {
  return mapLinesAndJsonAnd<HasUrl, ProjectAndOwner, ProjectDefn> ( makeProjectDefn ( azure ) ) ( pl )
};

export const projectDefn2RepoFiles = ( azure: AzureDetails ) => ( pd: ProjectDefn ): Promise<LinesAndJsonAnd<ProjectDefn, RepoAndEnabled[]>> =>
  fetchLinesAndParse<ProjectDefn, RepoAndEnabled[]> ( azure.fileOps, `Fetching ${JSON.stringify ( pd )}`, azure.parseRepoAndEnabled ) ( pd )


export const statDefns = ( azure: AzureDetails ) => async ( pd: LinesAndJsonAnd<ProjectDefn, RepoAndEnabled[]> ): Promise<RepoDefn[]> =>
  pd.json.filter ( re => re.enabled.toLowerCase () === 'true' ).map ( ( re: RepoAndEnabled ) => {
    const dic = { ...azure.dic, project: pd.project, ...re };
    const url = derefence ( `repos file`, dic, azure.statsPattern, { variableDefn: dollarsBracesVarDefn } )
    if ( azure.debug ) console.log ( 'statDefns url', url, 'dic', JSON.stringify ( dic, null, 2 ) );
    return { ...pd, ...re, url, json: undefined, lines: undefined }
  } );

export const stats = ( azure: AzureDetails ) => ( rd: RepoDefn ): Promise<LinesAndJsonAnd<RepoDefn, any>> =>
  fetchLinesAndParse<RepoDefn, any> ( azure.fileOps, `Fetching stats from ${rd.project} / ${rd.repo}`, jsonParser ) ( rd );

export async function walkProjectList ( azure: AzureDetails ): Promise<LinesAndJsonAnd<HasUrl, ProjectAndOwner[]>> {
  const root = rootFile ( azure )
  return await fetchLinesAndParse ( azure.fileOps, 'Fetching projects', azure.parseProjectAndOwner ) ( { url: root } )
}


export async function walkProjectDefns ( azure: AzureDetails ): Promise<ProjectDefn[]> {
  return projectListToProjectDefns ( azure ) ( await walkProjectList ( azure ) )
}

export async function walkAllRepoAndEnabled ( azure: AzureDetails ): Promise<LinesAndJsonAnd<ProjectDefn, RepoAndEnabled[]>[]> {
  return mapErrorsListK<ProjectDefn, LinesAndJsonAnd<ProjectDefn, RepoAndEnabled[]>> (
    pd => `fetching Repo contents ${JSON.stringify ( pd )}`,
    await walkProjectDefns ( azure ),
    projectDefn2RepoFiles ( azure ) )
}

export async function walkAllStateDefns ( azure: AzureDetails ): Promise<RepoDefn[]> {
  return flatMapErrorsListK<LinesAndJsonAnd<ProjectDefn, RepoAndEnabled[]>, RepoDefn> (
    re => `Fetching repo data from project ${re.project}`,
    await walkAllRepoAndEnabled ( azure ),
    statDefns ( azure ) )
}

export async function walkAllStats ( azure: AzureDetails ): Promise<LinesAndJsonAnd<RepoDefn, any>[]> {
  return mapErrorsListK ( rd => `Loading stats from ${JSON.stringify ( rd )}`,
    await walkAllStateDefns ( azure ),
    stats ( azure ) )
}
//--- now from a project

export async function walkProjectDefnsFromProject ( azure: AzureDetails, project: string ): Promise<LinesAndJsonAnd<ProjectDefn, RepoAndEnabled[]>> {
  const pd = makeProjectDefn ( azure ) ( { url: undefined }, { project, owner: '' } ) //is lack of owner a problem?
  return projectDefn2RepoFiles ( azure ) ( pd )
}

export async function walkAllStateDefnsFromProject ( azure: AzureDetails, project: string ): Promise<RepoDefn[]> {
  return statDefns ( azure ) ( await walkProjectDefnsFromProject ( azure, project ) )
}
export async function walkAllStatsFromProject ( azure: AzureDetails, project: string ): Promise<LinesAndJsonAnd<RepoDefn, any>[]> {
  return mapErrorsListK ( rd => `Loading stats from ${JSON.stringify ( rd )}`,
    await walkAllStateDefnsFromProject ( azure, project ),
    stats ( azure ) )
}
