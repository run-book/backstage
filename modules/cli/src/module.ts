import { NameAnd } from "@laoban/utils";

export interface Artifact {
  groupId: string
  artifactId: string
  fullname: string
  version: string
  packaging: string
  classifier?: string
  scope?: string
  optional?: boolean
  exclusions?: string[]
}
export interface RawModuleData {
  description: string
  groupId: string
  modules: string[]
  version: string
  scm: string
  properties: NameAnd<string>
}
export interface ModuleDependency {
  module: string
  ignore: boolean
  fullname: string
  groupId: string
  artifactId: string
  description: string
  kind: string
  properties: NameAnd<string>
  deps: Artifact[]
}
export const isLocal = ( moduleData: RawModuleData, debug: boolean ) => ( artifact: Artifact ): boolean => {
  if ( debug ) console.log ( `isLocal`, artifact )
  const groupIdMatches = artifact.groupId == moduleData.groupId;
  const moduleMatches = moduleData.modules.includes ( artifact.artifactId );
  return groupIdMatches && moduleMatches
};