import { listFilesRecursively } from "./file.search";
import { FileOps, parseJson } from "@laoban/fileops";
import { Artifact, ModuleDependency } from "./module";
import { NameAnd } from "@laoban/utils";


export function listNpmFiles ( fileOps: FileOps, dir: string ): Promise<string[]> {
  return listFilesRecursively ( fileOps, dir, f => f.endsWith ( 'package.json' ) )
}

export async function listNpmFilesAsModules ( fileOps: FileOps, dir: string ): Promise<ModuleDependency[]> {
  const files = await listNpmFiles ( fileOps, dir )
  return Promise.all ( files.map ( async f => extractModDependencyFromNpm ( f, parseJson ( f ) ( await fileOps.loadFileOrUrl ( f ) ) ) ) )
}

export function withJustLocalDeps(mds: ModuleDependency[]): ModuleDependency[] {
  return mds.map ( md => ({...md, deps: md.deps.filter ( a => mds.find(md => md.fullname===a.fullname))}) )
}

function getGroupIdAndArtifact ( fullname ) {
  const split = fullname?.split ( '/' )
  return split?.length !== 2 ? { groupId: '', artifactId: fullname } : { groupId: split[ 0 ], artifactId: split[ 1 ] };
}
// }

export function extractArtifactsFromNpmDependency ( dep: NameAnd<string> ): Artifact[] {
  return Object.entries ( dep ).map ( ( [ fullname, version ] ) => {
    const { groupId, artifactId } = getGroupIdAndArtifact ( fullname );
    return { groupId, artifactId, fullname, version }
  } )

}
export function extractModDependencyFromNpm ( module: string, npm: any ): ModuleDependency {
  const properties = npm.backstage ?? {}
  const fullname = npm.name
  const { groupId, artifactId } = getGroupIdAndArtifact ( fullname );
  const deps = extractArtifactsFromNpmDependency ( npm.dependencies ?? {} )
  return {
    module,
    fullname,
    groupId,
    artifactId,
    version: npm.version,
    description: npm.description,
    ignore: properties.ignore ?? false,
    kind: properties.kind ?? 'Component',
    properties,
    deps,
  }
}