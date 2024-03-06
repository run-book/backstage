import { ErrorsAnd, hasErrors, NameAnd } from "@laoban/utils";

import path from "path";
import { parseStringPromise } from "xml2js";
import { defaultMakeCatalogFromArray, ModuleDependencyFileType } from "./filetypes";
import { Artifact, isModuleDependency, ModuleData, ModuleDependency } from "../module";
import { catalogInfoFilename, Policy } from "../policy";
import { gitRepo } from "../git/git";


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
export function simplePomModuleDependency ( pathOffset: string, policy: Policy, pom: any, defaultScm: string | undefined,mkdocsExists:boolean, debug: boolean | undefined ): ErrorsAnd<ModuleDependency> {
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
  const scm = project.scm?.url ?? project.scm?.connection ?? defaultScm
  const catalogName = catalogInfoFilename ( policy, 'maven', path.dirname ( pathOffset ) )
  return {
    pathOffset,
    catalogName,
    sourceType: 'maven',
    parent,
    ...artifact,
    scm, deps, description, kind, properties, ignore, version,mkdocsExists
  }
}

export async function loadAndParsePom ( fileOps: any, policy: Policy, pathOffset: string, file: string, debug?: boolean ): Promise<ErrorsAnd<ModuleDependency>> {
  const pomString = await fileOps.loadFileOrUrl ( file );
  const defaultScm = await gitRepo ( file, debug )
  const json = await parseStringPromise ( pomString, { explicitArray: false } )
  const mkdocsExists = await fileOps.isFile ( path.join ( path.dirname ( file ), 'mkdocs.yml' ) )
  const md = simplePomModuleDependency ( pathOffset, policy, json, defaultScm,mkdocsExists, debug )
  return md
}

export function makePomArray ( entityToMd: NameAnd<ModuleDependency> ): ( md: ModuleDependency ) => ModuleDependency[] {
  return ( md: ModuleDependency ) => {
    const parent = entityToMd[ md.parent?.fullname ?? '' ]
    // console.log(`makePomArray`, md.pathOffset, 'parent',md.parent,  parent);
    if ( parent === undefined ) return [ md ]
    return [ ...makePomArray ( entityToMd ) ( parent ), md ]
  }
}

export function pomArrayHelper ( mds: ModuleData[] ): NameAnd<ModuleDependency> {
  const filters: ModuleDependency[] = mds.filter ( md => !hasErrors ( md ) && isModuleDependency ( md ) && md.sourceType === 'maven' ) as ModuleDependency[];
  const result: NameAnd<ModuleDependency> = Object.fromEntries ( filters.map ( md => [ md.fullname, md ] ) );
  return result;
}
/** The array helper is map from the entity name to the module data for that entity. And only for poms. This lets us find our parent as poms include the name of the parent */
export const pomFiletype: ModuleDependencyFileType<NameAnd<ModuleDependency>> = {
  sourceType: 'maven',
  match: ( filename: string ) => filename === 'pom.xml',
  load: loadAndParsePom,
  makeArrayHelper: pomArrayHelper,
  makeArray: makePomArray,
  makeCatalogFromArray: defaultMakeCatalogFromArray
}