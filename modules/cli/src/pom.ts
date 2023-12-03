import { FileOps } from "@laoban/fileops";
import path from "path";
import { parseStringPromise } from "xml2js";

export interface Artifact {
  groupId: string
  artifactId: string
  version: string
  packaging: string
  classifier?: string
  scope?: string
  optional?: boolean
  exclusions?: string[]
}
export interface RawModuleData{
  description: string
  groupId: string
  modules: string[]
  version: string
}
export interface ModuleDependency {
  module: string
  groupId: string
  artifactId: string
  description: string
  deps: Artifact[]
}


export function extractDependencies ( pom: any ): Artifact[] {
  const dependencies = pom?.project?.dependencies?.dependency
  if ( Array.isArray ( dependencies ) ) return dependencies
  return [ dependencies ] ?? []
}

export const isLocal = ( moduleData: RawModuleData ) => ( artifact: Artifact ): boolean => {
  const groupIdMatches = artifact.groupId == moduleData.groupId;
  const moduleMatches = moduleData.modules.includes ( artifact.artifactId );
  return groupIdMatches && moduleMatches
};
export async function loadPom ( fileOps: FileOps, pomDir: string ): Promise<String> {
  const pomFile = path.resolve ( fileOps.join ( pomDir, "pom.xml" ) )
  if ( await fileOps.isFile ( pomFile ) ) {
    return fileOps.loadFileOrUrl ( pomFile )
  } else
    throw new Error ( `pom file ${pomFile} does not exist` )
}

export function extractModules ( pom: any ): string[] {
  const modules = pom?.project?.modules?.module
  return modules ?? []
}

export async function loadAndParse ( fileOps: FileOps, dir: string ) {
  return await parseStringPromise ( await loadPom ( fileOps, dir ), { explicitArray: false } );
}


export async function loadAndListModules ( fileOps: FileOps, dir: string | undefined ): Promise<RawModuleData> {
  const pom = await loadAndParse ( fileOps, dir );
  const modules = extractModules ( pom )
  const groupId = pom?.project?.groupId
  const version = pom?.project?.version
  const description = pom?.project?.description
  return { modules, groupId, version, description }
}
