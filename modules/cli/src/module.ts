import { NameAnd } from "@laoban/utils";

export interface Artifact {
  groupId: string
  artifactId: string
  fullname: string
  version: string
}
export interface RawModuleData {
  description: string
  groupId: string
  modules: string[]
  version: string
  scm: string
  properties: NameAnd<string>
}

export type SourceType = 'maven' | 'npm'

export interface ModuleDependency {
  sourceType: SourceType
  module: string
  scm: string
  ignore: boolean
  fullname: string
  groupId: string
  artifactId: string
  version?: string
  description: string
  kind: string
  properties: NameAnd<string>
  deps: Artifact[]
}

export type ModDependenciesAndName = {
  modData: ModuleDependency[]
  name?: string
}
export const isLocal = ( moduleData: RawModuleData, debug: boolean ) => ( artifact: Artifact ): boolean => {
  if ( debug ) console.log ( `isLocal`, artifact )
  const groupIdMatches = artifact.groupId == moduleData.groupId;
  const moduleMatches = moduleData.modules.includes ( artifact.artifactId );
  return groupIdMatches && moduleMatches
};