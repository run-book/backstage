import { ErrorsAnd, NameAnd } from "@laoban/utils";

import path from "path";
import { FileOps, parseJson } from "@laoban/fileops";
import { defaultMakeCatalog, FileType } from "./filetypes";
// import { extractArtifactsFromNpmDependency, extractScm } from "../npm";
import { Artifact, ModuleDependency } from "../module";

export function nameToArtifact ( fullname: string, version: string ): Artifact {
  const split = fullname?.split ( '/' )
  const common = { fullname, version }
  return split?.length !== 2 ? { ...common, groupId: '', artifactId: fullname } : { ...common, groupId: split[ 0 ], artifactId: split[ 1 ] };
}
export function extractScm ( npm: any ) {
  const repository = npm.repository?.url ?? npm.repository?.directory ?? npm.repository?.git ?? 'Unknown scm'
  return repository
}
export function extractArtifactsFromNpmDependency ( dep: NameAnd<string> ): Artifact[] {
  return Object.entries ( dep ).map ( ( [ fullname, version ] ) =>
    nameToArtifact ( fullname, version ) )
}
export function simpleNpmModuleDependency ( pathOffset: string, npm: any, debug: boolean | undefined ): ErrorsAnd<ModuleDependency> {
  const fullname = npm.name
  const properties = npm.backstage ?? {}
  const version = npm.version
  const artifact = nameToArtifact ( fullname, version )
  const deps = extractArtifactsFromNpmDependency ( npm.dependencies ?? {} )
  const scm = extractScm ( npm )
  const description = npm.description
  const ignore = fullname === undefined ? true : properties?.ignore ?? false
  const catalogName = `${path.dirname ( pathOffset )}/catalog-info.yaml`
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
export async function loadNpm ( fileOps: FileOps, pathOffset: string, file: string, debug?: boolean ): Promise<ErrorsAnd<ModuleDependency>> {
  const contents = await fileOps.loadFileOrUrl ( file );
  const json = await parseJson ( file ) ( contents )
  const md = simpleNpmModuleDependency ( pathOffset, json, debug )
  return md;
}

export function makeNpmArray ( pathToMd: NameAnd<ModuleDependency>, entityToMd: NameAnd<ModuleDependency> ): ( md: ModuleDependency ) => ModuleDependency[] {
  return ( md: ModuleDependency ) => {
    return [ md ] // OK we should recursively walk the path and add the parents but this is OK for now
  }
}
export const npmFiletype: FileType = {
  sourceType: 'npm',
  match: ( filename: string ) => filename === 'package.json',
  load: loadNpm,
  makeArray: makeNpmArray,
  makeCatalog: defaultMakeCatalog
}