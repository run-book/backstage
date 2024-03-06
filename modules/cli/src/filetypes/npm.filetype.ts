import { ErrorsAnd, NameAnd } from "@laoban/utils";

import path from "path";
import { FileOps, parseJson } from "@laoban/fileops";
import { defaultMakeCatalogFromArray, ModuleDependencyFileType } from "./filetypes";
// import { extractArtifactsFromNpmDependency, extractScm } from "../npm";
import { Artifact, moduleDataPath, ModuleDependency } from "../module";
import { makeTreeFromPathFnAndArray, Tree } from "../tree";
import { catalogInfoFilename, Policy } from "../policy";
import { cleanString } from "../strings";
import { gitRepo } from "../git/git";

export function nameToArtifact ( fullname: string, version: string ): Artifact {
  const split = fullname?.split ( '/' )
  const common = { fullname: cleanString ( fullname ), version }
  return split?.length !== 2 ? { ...common, groupId: '', artifactId: fullname } : { ...common, groupId: split[ 0 ], artifactId: split[ 1 ] };
}
export function extractScm ( npm: any, defaultScm: string | undefined ) {
  const repositoryObject = npm.repository
  if ( typeof repositoryObject === 'string' ) return repositoryObject
  const repository = npm.repository?.url ?? npm.repository?.directory ?? npm.repository?.git ?? defaultScm
  return repository
}
export function extractArtifactsFromNpmDependency ( dep: NameAnd<string> ): Artifact[] {
  return Object.entries ( dep ).map ( ( [ fullname, version ] ) =>
    nameToArtifact ( fullname, version ) )
}
export function simpleNpmModuleDependency ( pathOffset: string, policy: Policy, npm: any, defaultScm: string | undefined, debug: boolean | undefined ): ErrorsAnd<ModuleDependency> {
  const fullname = npm.name
  const properties = npm.backstage ?? {}
  const version = npm.version
  const artifact = nameToArtifact ( fullname, version )
  const deps = extractArtifactsFromNpmDependency ( npm.dependencies ?? {} )
  const scm = extractScm ( npm, defaultScm )
  const description = npm.description
  const ignore = fullname === undefined ? true : properties?.ignore ?? false
  const catalogName = catalogInfoFilename ( policy, 'npm', path.dirname ( pathOffset ) )
  return {
    sourceType: 'npm',
    parent: undefined,
    catalogName,
    pathOffset,
    ...artifact,
    scm,
    ignore,
    version,
    description,
    kind: properties.kind ?? 'Component',
    properties,
    deps,
  }
}
export async function loadNpm ( fileOps: FileOps, policy: Policy, pathOffset: string, file: string, debug?: boolean ): Promise<ErrorsAnd<ModuleDependency>> {
  const contents = await fileOps.loadFileOrUrl ( file );
  const defaultScm = await gitRepo ( file, true )
  if ( debug ) console.log ( 'defaultScm', file, defaultScm, file )
  const json = await parseJson ( file ) ( contents )
  const md = simpleNpmModuleDependency ( pathOffset, policy, json, defaultScm, debug )
  return md;
}

export function makeNpmArray ( trees: NameAnd<Tree<ModuleDependency>>, ): ( md: ModuleDependency ) => ModuleDependency[] {
  return ( md: ModuleDependency ) => {
    const p = moduleDataPath ( md )
    const tree = trees[ p ]
    if ( tree === undefined ) throw new Error ( `The tree is not defined for ${p}` )
    const parent = tree.parent
    if ( parent === undefined ) return [ md ]
    return [ ...makeNpmArray ( trees ) ( parent.value ), md ]
  }
}

export function makeNpmArrayHelper ( mds: ModuleDependency[] ) {
  return makeTreeFromPathFnAndArray<ModuleDependency> ( moduleDataPath, mds )
}
export const npmFiletype: ModuleDependencyFileType<NameAnd<Tree<ModuleDependency>>> = {
  sourceType: 'npm',
  match: ( filename: string ) => filename === 'package.json',
  load: loadNpm,
  makeArrayHelper: makeNpmArrayHelper,
  makeArray: makeNpmArray,
  makeCatalogFromArray: defaultMakeCatalogFromArray
}