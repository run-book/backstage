import cp from "child_process";
import path from "path";

export interface SuccessfulGitResult {
  message: string
  code: 0
}
export function isSuccessfulGitResult ( t: GitResult ): t is SuccessfulGitResult {
  return t.code === 0
}
export interface FailedGitResult {
  message?: string
  error: string
  code: number
}
export type GitResult = SuccessfulGitResult | FailedGitResult

export const executeScriptInShell = ( cwd: string, cmd: string, debug?: boolean ): Promise<GitResult> => {
  if ( debug ) console.log ( 'executeScriptInShell', cwd, cmd.trim () )
  return new Promise<GitResult> ( resolve => {
    cp.exec ( cmd, { cwd, env: process.env }, ( error, stdout, stdErr ) => {
      if ( debug ) console.log ( 'exec', cmd.trim (), error, stdout, stdErr )
      if ( error === null || error.code === 0 )
        resolve ( { message: stdout.toString (), code: 0 } )
      else
        resolve ( { message: stdout.toString (), error: stdErr.toString (), code: error.code } )
    } )
  } );
};

export async function gitRepo ( dir: string, debug?: boolean ): Promise<string | undefined> {
  const gitResult = await executeScriptInShell ( path.dirname(dir), 'git remote get-url origin' )
  if ( isSuccessfulGitResult ( gitResult ) )
    {
      const rawUrl = gitResult.message.trim();
      try {
        const url = new URL ( rawUrl )
        url.username = ''
        url.password = ''
        return url.toString ()
      }catch ( e   )      {
        // console.log('gitRepo', e, rawUrl)
        return rawUrl
      }
    }
  else
    return undefined
}
