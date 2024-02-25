import { CommandContext } from "./context";
import { FileOps } from "@laoban/fileops";
import { defaultIgnoreFilter, scanDirectory } from "@laoban/fileops";
import { load } from "js-yaml";


function ignoreGitTargetNodeModules ( s: string ): boolean {
  return s != '.git' && s != 'node_modules' && s != 'target'
}
export async function findYamls ( fileOps: FileOps, directory: string ): Promise<string[]> {
  return scanDirectory ( fileOps, defaultIgnoreFilter ) ( directory, s => s.endsWith ( '.yaml' ) )
}
export function categorise ( f: FileAndYaml ): 'library' | 'api' | 'service' | 'error' | undefined {
  const { yaml, error } = f
  if ( error ) return 'error'
  if ( yaml?.spec?.type === 'library' ) return 'library'
  if ( yaml?.kind === 'Service' ) return 'service'
  if ( yaml?.kind === 'API' ) return 'api'
  return undefined
}

export type FileAndYaml = { file: string, yaml?: any, error?: string }

function parseYaml ( file: string, contents: string ) {
  try {
    const yaml = load ( contents ) as any
    return { file, yaml }
  } catch ( e ) {
    return { file, error: e.toString () }
  }
}
function makeRepoSummary ( catalogs: Awaited<{ file: string; yaml: any } | { file: string; error: string }>[] ) {
  const all: string[] = []
  const apis: string[] = []
  const errors: FileAndYaml[] = []
  const libraries: string[] = []
  const services: string[] = []
  catalogs.forEach ( c => {
    const cat = categorise ( c )
    if ( cat === 'error' ) errors.push ( c )
    if ( cat === 'api' ) apis.push ( c.file )
    if ( cat === 'library' ) libraries.push ( c.file )
    if ( cat === 'service' ) services.push ( c.file )
    all.push ( c.file )
  } )
  return { all, apis, errors, libraries, services };
}
export function addSummariseCommand ( context: CommandContext ) {
  context.command.command ( "summarise [directory]" )
    .description ( "Make a json summary describing software catalogs and (not yet)docs on the standard output. Directory defaults to ." )
    .option ( "-o,--owner <owner>", "owner of the repository. This is included in the summary info but has no other purpose" )
    .option ( '-p, --project <project>', 'project of the repository. This is included in the summary info but has no other purpose' )
    .option ( '-r, --repo <repo>', 'name of the repository. This is included in the summary info but has no other purpose' )
    .option ( '-e, --enabled', 'Is this enabled. This is included in the summary info, but has no other purpose' )
    .option ( '-y, --yamls', 'just lists all yaml files' )
    .option ( '-l, --list', 'just lists the software catalogs and the documents (for debugging usually)' )
    .action ( async ( directory, opts ) => {
      const dir = directory || context.currentDirectory
      const { debug, yamls, list, owner, project, repo, enabled } = opts
      if (debug)console.log('dir',dir)
      const yamlFiles = await findYamls ( context.fileOps, dir )
      if ( yamls ) {
        console.log ( 'yamls', yamlFiles )
        return
      }
      const filesAndJson = await Promise.all ( yamlFiles.map ( async file =>
        parseYaml ( file, await context.fileOps.loadFileOrUrl ( file ) ) ) )
      const catalogData = filesAndJson.filter ( f => f.yaml?.apiVersion || f.error )
      if ( list ) {
        catalogData.forEach ( c => console.log ( c.file ) )
        return
      }
      const catalogs = makeRepoSummary ( catalogData );
      const result = { owner, project, repo, enabled, catalogs }//will add docs later when have clear idea what they look like
      console.log ( JSON.stringify ( result, undefined, 2 ) )

    } )
}

