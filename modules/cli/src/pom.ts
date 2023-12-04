import { FileOps } from "@laoban/fileops";
import path from "path";
import { parseStringPromise } from "xml2js";
import { NameAnd } from "@laoban/utils";
import { Artifact, isLocal, ModuleDependency, RawModuleData } from "./module";


const filterBackspaceKeys = ( jsonObj: NameAnd<string> ): NameAnd<string> => {
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
export function extractDependencies ( pom: any, debug: boolean ): Artifact[] {
  if ( debug ) console.log ( `extractDependencies`, pom?.project?.dependencies )
  const dependencies = pom?.project?.dependencies?.dependency
  if ( dependencies === undefined ) return []
  const deps = Array.isArray ( dependencies ) ? dependencies : [ dependencies ];
  deps.forEach ( dep => {dep[ 'fullname' ] = `${dep.groupId}.${dep.artifactId}`} )
  return deps
}

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
  const scm = pom?.project?.scm?.url ?? pom?.project?.scm?.connection ?? 'Unknown scm'
  const properties = filterBackspaceKeys ( pom.project?.properties ?? {} )
  return { modules, groupId, version, description, scm, properties }
}
export async function findAllDependencies ( fileOps: FileOps, moduleData: RawModuleData, dir: string, debug: boolean ): Promise<ModuleDependency[]> {
  const { groupId, modules } = moduleData;
  if ( debug ) console.log ( `groupId ${groupId} modules ${modules}` )
  const mods: ModuleDependency[] = await Promise.all ( modules.map ( async module => {
    const moduleDir = path.resolve ( fileOps.join ( dir, module ) )
    if ( debug ) console.log ( `moduleDir ${moduleDir}` )
    const modulePom = await loadAndParse ( fileOps, moduleDir )
    const allDeps = extractDependencies ( modulePom, debug );
    if ( debug ) console.log ( `   allDeps for ${module}`, allDeps )
    const description = modulePom.project.description
    const properties = filterBackspaceKeys ( modulePom.project?.properties ?? {} )
    const kind = properties?.kind ?? "Component"
    const ignore = properties?.ignore === 'true' ?? false
    const deps = allDeps.filter ( isLocal ( moduleData, debug ) )
    const fullname = `${groupId}.${module}`
    return { module, groupId, artifactId: module, fullname, deps, description, kind, properties, ignore }
  } ) )
  const result = mods.filter ( m => !m.ignore )
  return result;
}