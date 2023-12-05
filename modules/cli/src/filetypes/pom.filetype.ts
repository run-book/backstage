import { ErrorsAnd, hasErrors, NameAnd } from "@laoban/utils";

import path from "path";
import { parseStringPromise } from "xml2js";
import { defaultMakeCatalog, FileType } from "./filetypes";
import { Artifact, ModuleData, ModuleDependency } from "../module";
import { Tree } from "../tree";


export function makeArtifact ( path: string, fragment: any, defArtifact?: Artifact ): ErrorsAnd<Artifact | undefined> {
  if ( fragment === undefined ) return undefined
  const artifactId = fragment?.artifactId
  const groupId = fragment?.groupId ?? defArtifact?.groupId
  const version = fragment?.version ?? defArtifact?.version
  if ( groupId === undefined ) return [ `The groupId is not defined for ${path}` ]
  if ( version === undefined ) return [ `The version is not defined for ${path}` ]
  const fullname = `${groupId}.${artifactId}`
  return { groupId, artifactId, version, fullname }
}

export const filterBackspaceKeys = ( jsonObj: NameAnd<string> ): NameAnd<string> => {
  const result: NameAnd<string> = {};
  const regex = /^backstage\.(.+)$/;
  Object.keys ( jsonObj ).forEach ( key => {
    const match = key.match ( regex );
    if ( match ) {
      const newKey = match[ 1 ];
      result[ newKey ] = jsonObj[ key ];
    }
  } );
  return result;
};
export function extractPomDependencies ( pom: any, debug: boolean ): Artifact[] {
  if ( debug ) console.log ( `extractDependencies`, pom?.project?.dependencies )
  const dependencies = pom?.project?.dependencies?.dependency
  if ( dependencies === undefined ) return []
  const deps = Array.isArray ( dependencies ) ? dependencies : [ dependencies ];
  deps.forEach ( dep => {dep[ 'fullname' ] = `${dep.groupId}.${dep.artifactId}`} )
  return deps
}
export function simplePomModuleDependency ( pathOffset: string, pom: any, debug: boolean | undefined ): ErrorsAnd<ModuleDependency> {
  const project = pom.project
  if ( project === undefined ) return [ `The file ${pathOffset} does not have a project element` ]
  const parent = makeArtifact ( `${pathOffset}/parent`, project.parent )
  if ( debug ) console.log ( `parent`, pathOffset, parent, project.parent )
  if ( hasErrors ( parent ) ) return parent
  const artifact = makeArtifact ( pathOffset, project, parent )
  const deps = extractPomDependencies ( pom, debug );
  if ( debug ) console.log ( `   allDeps for ${pathOffset}`, deps )
  const description = pom.project.description
  const properties = filterBackspaceKeys ( project.properties ?? {} )
  const kind = properties?.kind ?? "Component"
  const ignore = properties?.ignore === 'true' ?? false
  const version = project.version
  const scm = project.scm?.url ?? project.scm?.connection
  const catalogName = `${path.dirname ( pathOffset )}/catalog-info.yaml`
  return {
    pathOffset,
    catalogName,
    sourceType: 'maven',
    parent,
    ...artifact,
    scm, deps, description, kind, properties, ignore, version
  }
}

export async function loadAndParsePom ( fileOps: any, pathOffset: string, file: string, debug?: boolean ): Promise<ErrorsAnd<ModuleDependency>> {
  const pomString = await fileOps.loadFileOrUrl ( file );
  const json = await parseStringPromise ( pomString, { explicitArray: false } )
  const md = simplePomModuleDependency ( pathOffset, json, debug )
  return md
}

export function makePomArray ( trees: NameAnd<Tree<ModuleData>>, entityToMd: NameAnd<ModuleDependency> ): ( md: ModuleDependency ) => ModuleDependency[] {
  return ( md: ModuleDependency ) => {
    const parent = entityToMd[ md.parent?.fullname ?? '' ]
    // console.log(`makePomArray`, md.pathOffset, 'parent',md.parent,  parent);
    if ( parent === undefined ) return [ md ]
    return [ ...makePomArray ( trees, entityToMd ) ( parent ), md ]
  }
}
export const pomFiletype: FileType = {
  sourceType: 'maven',
  match: ( filename: string ) => filename === 'pom.xml',
  load: loadAndParsePom,
  makeArray: makePomArray,
  makeCatalog: defaultMakeCatalog
}