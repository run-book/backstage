import { ErrorsAnd, hasErrors, NameAnd } from "@laoban/utils";
import path from "path";

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

export type SourceType = 'maven' | 'npm' | 'catalogdata' | 'backstageyaml'


export interface CatalogData {
  catalogData: true
  sourceType: SourceType
  pathOffset: string
  catalogName: string
  ignore: boolean
  value: string
}

export interface ModuleDependency extends Artifact {
  sourceType: SourceType
  //This is the entity name of any parent. Meaningful in pom.xml. Not in package.json
  parent: Artifact | undefined
  //The full filename of entity file to generate. default is ${parent(pathOffset)}/catalog-info.yaml
  catalogName: string
  //The path offset of the file from the root. Includes the file name
  pathOffset: string
//data to define where the git repo is
  scm: string
  //If true, then this is ignored for most purposes. It won't be added to the catalog
  ignore: boolean
  // in package.json we can have names like @laoban/xxx. In pom.xml this is the groupId
  description: string
  // Will normally be Component.
  kind: string
  //All the properties in the pom.xml that are <backstage.xxx>  and in the package.json under the key backstage
  properties: NameAnd<string>
  //The dependencies in the pom.xml or package.json
  deps: Artifact[]
}
export type ModuleData = ErrorsAnd<ModuleDependency | CatalogData>

export function debugStringForMd ( md: ModuleData ): string {
  if ( hasErrors ( md ) ) return `Errors: ${md.join ( '\n' )}`
  if ( isCatalogData ( md ) ) return `CatalogData: ${md.pathOffset}`
  if ( isModuleDependency ( md ) )  return `ModuleData: ${md.pathOffset}`
  return `Unknown: ${md}`
}
export function moduleDataPath ( md: ModuleData ): string|undefined {
  if ( hasErrors ( md ) ) return undefined
  return path.dirname(md.pathOffset)
}

export function isCatalogData ( md: ModuleData ): md is CatalogData {
  return (md as CatalogData).catalogData !== undefined
}
export function isModuleDependency ( md: ModuleData ): md is ModuleDependency {
  return (md as CatalogData)?.catalogData === undefined
}
export type ModDependenciesAndName = {
  modData: ModuleDependency[]
  name?: string
}
export function displayErrors ( loaded: ModuleData[] ) {
  const allErrors = loaded.filter ( hasErrors ).flat ()
  if ( allErrors.length > 0 ) {
    console.log ( 'Errors' )
    for ( const error of allErrors ) {
      console.log ( error )
    }
  }
}
