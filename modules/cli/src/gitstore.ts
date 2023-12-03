import path from "path";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);
export const execute: ExecuteFn = async ( command, dir: string ) => {
  try {
    const options = { cwd: dir };
    const { stdout, stderr } = await execAsync ( command, options );
    // If the command executes successfully, the exit code is 0
    return { stdout, stderr, code: 0 };
  } catch ( error: any ) {
    // If there is an error, capture the error message, and the exit code
    return { stdout: '', stderr: error.message, code: error.code };
  }
};
export interface Gitstore {
  createIfNeeded: CreateIfNeededFn;
  status: ( organisation: string, repo: string ) => Promise<StatusData>
  currentBranch: () => Promise<string>
  currentRepo: (dir: string) => Promise<string>
  delete: ( organisation: string, repo: string ) => Promise<StatusData>;
  push: ( organisation: string, repo: string, branch: any ) => Promise<GitPushResult>
  cloneOrFetch: ( organisation: string, repo: string, branch: any, target: string ) => Promise<StatusData>;
  commitCount: ( repo: string, target: string, branch: string ) => Promise<number>
}

export type CreateIfNeededFn = ( organisation: string, newRepo: string, title: string ) => Promise<StatusData>
export type FetchFn = ( url: RequestInfo, info?: RequestInit, ) => Promise<Response>
export type ExecuteFn = ( command: string, executeDir?: string ) => Promise<ExecuteResult>

export const executeOrError = ( execute: ExecuteFn ) => async ( command: string ): Promise<string> => {
  const { stdout, stderr, code } = await execute ( command );
  if ( code === 0 ) {
    return stdout.trim ();
  } else {
    throw new Error ( stderr );
  }
};

interface ExecuteResult {
  stdout: string
  stderr: string
  code: number
}
interface StatusData {
  statusCode: number
  data?: any
  error?: string

}
const simpleResponse = async ( resp: Response ): Promise<StatusData> => {
  let statusCode = resp.status;
  return statusCode < 300 ? { data: await resp.json (), statusCode } : { error: await resp.text (), statusCode };
}

export interface GitPushResult {
  repo: string
  branch: string
  succeeded: boolean
  error?: string
}
const httpGitName = ( token: string, organisation: string, repo: string ) => `https://${token}@github.com/${organisation}/${repo}.git`;
const pushForGit = ( execute: ExecuteFn, token: string ) => async ( organisation: string, repo: string, branch: string ): Promise<GitPushResult> => {
  const result = await execute ( `git push ${httpGitName ( token, organisation, repo )} ${branch}` );
  if ( result.code == 0 ) return { repo, succeeded: true, branch }
  else return { repo, error: result.stderr, succeeded: false, branch }
}

async function addOrigin ( execute: ( command: string, executeDir?: string ) => Promise<ExecuteResult>, target: string, organisation: string, repo: string, token: string ) {
  return await execute ( `git remote add origin ${httpGitName ( token, organisation, repo )}`, path.join ( target, repo ) );
}
async function removeOrigin ( execute: ( command: string, executeDir?: string ) => Promise<ExecuteResult>, target: string, repo: string ) {
  return await execute ( `git remote remove origin`, path.join ( target, repo ) );
}
const cloneOrFetchForGit = ( execute: ExecuteFn, token: string ) => async ( organisation: string, repo: string, branch: string, target: string ): Promise<StatusData> => {
  const result = await execute ( `git clone ${httpGitName ( token, organisation, repo )} -b ${branch}`, target );
  if ( result.code == 0 ) {
    await removeOrigin ( execute, target, repo );
    return { statusCode: 0, data: `clone${result.stdout}` }
  } else if ( result.stderr.includes ( "already exists and is not an empty directory" ) ) {
    await addOrigin ( execute, target, organisation, repo, token );
    const result = await execute ( `git fetch origin ${branch}`, path.join ( target, repo ) );
    await execute ( `git reset origin/${branch}`, path.join ( target, repo ) );
    await removeOrigin ( execute, target, repo );
    return { statusCode: 0, data: `fetch and reset\n ${result.stderr}` }
  }
  return { statusCode: result.code, error: result.stderr }
}

const createForGithub = ( fetch: FetchFn, token: string ): CreateIfNeededFn => ( organisation: string, newRepo: string, title: string ) => {
  const body = {
    org: organisation,
    name: newRepo,
    description: title,
    // homepage: 'https://github.com',
    'private': false,
    has_issues: false,
    has_projects: true,
    has_wiki: false,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    }
  }
  let rawHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json'
  };
  const headers = new Headers ( rawHeaders );
  let url = `https://api.github.com/orgs/${organisation}/repos`;
  // console.log ( 'url', url )
  // console.log ( 'rawHeaders', rawHeaders )
  // console.log ( 'rawBody', JSON.stringify ( body ) )
  let requestDetails = { method: 'POST', headers, body: JSON.stringify ( body ) };
  return fetch ( url, requestDetails ).then ( simpleResponse )
}
const statusForGithub = ( fetch: FetchFn ) => async ( organisation: string, repo: string ): Promise<StatusData> => {
  let url = `https://api.github.com/repos/${organisation}/${repo}`;
  // console.log ( 'url', url )
  // console.log ( 'organisation', organisation )
  // console.log ( 'repo', repo )
  return fetch ( url ).then ( async response => {
    const statusCode = response.status
    if ( statusCode < 300 ) {
      const repoData = await response.json ()
      return Promise.resolve ( { statusCode, repoData } )
    } else {
      return response.text ().then ( error => ({ statusCode, error }) )
    }
  } )
};

export const currentBranch = ( execute: ExecuteFn ) => {
  return () => {
    let command = 'git rev-parse --abbrev-ref HEAD';
    return execute ( command ).then ( ( { stdout, stderr, code } ) => {
      if ( code !== 0 ) throw new Error ( `${command} failed with code ${code} and stderr ${stderr}` )
      if ( stdout.trim ().length === 0 ) throw new Error ( `${command} failed with code ${code} and stderr ${stderr}` )
      return stdout.trim ()
    } )
  }
}
export const currentRepo = ( execute: ExecuteFn ) => {
  return (dir: string) => {
    return execute ( 'git config --get remote.origin.url' , dir).then ( ( { stdout, stderr, code } ) => {
      if ( code !== 0 ) throw new Error ( `git config --get remote.origin.url failed with code ${code} and stderr ${stderr}` )
      if ( stdout.trim ().length === 0 ) throw new Error ( `git config --get remote.origin.url failed with code ${code} and stderr ${stderr}` )
      return stdout.trim ()
    } )
  }
}

export const deleteForGithub = ( fetch: FetchFn, token: string ) => async ( organisation: string, repo: string ) => {
  const body = {
    org: organisation,
    repo,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    }
  }
  let rawHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json'
  };
  const headers = new Headers ( rawHeaders );
  let url = `https://api.github.com/repos/${organisation}/${repo}`;
  console.log ( 'url', url )
  console.log ( 'rawHeaders', rawHeaders )
  console.log ( 'rawBody', JSON.stringify ( body ) )
  let requestDetails = { method: 'DELETE', headers, body: JSON.stringify ( body ) };
  return fetch ( url, requestDetails ).then ( simpleResponse )
}

function commitCountForGit ( executeFn: ExecuteFn ) {
  return async ( repo: string, target: string, branch: string ) => {
    const result = await executeFn ( `git rev-list --count ${branch}`, path.join ( target, repo ) );
    if ( result.code === 0 ) return parseInt ( result.stdout.trim () );
    else throw new Error ( result.stderr );
  }
}
export const GithubStore = ( fetch: FetchFn, executeFn: ExecuteFn, token: string ): Gitstore => {
  if ( token === undefined ) throw new Error ( 'GITHUB_TOKEN is undefined' )
  return ({
    createIfNeeded: createForGithub ( fetch, token ),
    status: statusForGithub ( fetch ),
    currentBranch: currentBranch ( executeFn ),
    currentRepo: currentRepo ( executeFn ),
    delete: deleteForGithub ( fetch, token ),
    push: pushForGit ( executeFn, token ),
    cloneOrFetch: cloneOrFetchForGit ( executeFn, token ),
    commitCount: commitCountForGit ( executeFn )
  });
}