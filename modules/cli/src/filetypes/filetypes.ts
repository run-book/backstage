import { CatalogData, isCatalogData, isModuleDependency, ModuleData, ModuleDependency, SourceType } from "../module";
import { ErrorsAnd, hasErrors, NameAnd } from "@laoban/utils";
import { FileOps } from "@laoban/fileops";
import { applyCatalogTemplateForKind } from "../templates";
import { listFilesRecursively } from "../file.search";
import path from "path";


export type FileType = {
  //Must be unique.
  sourceType: SourceType
  //Does a filename match the requirements. Could be pom.xml. Could be backstage.xxx.yaml. Could be catalog-info.yaml... etc
  match: ( filename: string ) => boolean
  //Give a file and the parsed content what is the kind.
  load: ( fileOps: FileOps, pathOffset: string, filename: string, debug?: boolean ) => Promise<ModuleData>
  //Given a module this will find the parents and place into an array with the md at the end
  makeArray: ( pathToMd: NameAnd<ModuleData>, entityToMd: NameAnd<ModuleData> ) => ( md: ModuleData ) => ModuleData[]
  makeCatalog: ( fileOps: FileOps, defaults: any, templateDir: string, array: ModuleData[] ) => Promise<ErrorsAnd<CatalogData>>
}

function makeDictionaryPart ( existing: any, md: ModuleDependency ) {
  const existingDependsOn = existing.dependsOn ?? []
  const dependsOn = [ ...existingDependsOn, ...md.deps.map ( a => `   -  component:${a.fullname}` ) ]
  return {
    ...existing,
    errors: existing.errors ?? [],
    fullname: `${md.fullname}`,
    groupId: md.groupId ?? existing.groupId,
    artifactId: md.artifactId, // Note we DON't want to default artifact Id... we want an error
    description: md.description ?? '"..."', // Note we DON'T want to default description to the parent
    scm: md.scm ?? existing.scm,
    kind: md.kind ?? existing.kind,
    dependsOn,
    ...md.properties,
  }
}

export function makeDictionary ( defaults: any, mds: ModuleData[] ): any {
  let dic: any = { dependsOn: [], ...defaults }
  for ( const md of mds ) {
    if ( hasErrors ( md ) ) dic.errors = (dic.errors ?? []).concat ( md )
    if ( isModuleDependency ( md ) ) dic = makeDictionaryPart ( dic, md )
  }
  dic.dependsOn = dic.dependsOn.length === 0 ? '' : 'dependsOn: \n' + dic.dependsOn.join ( '\n' )
  return dic
}

export async function defaultMakeCatalog ( fileOps: FileOps, defaults: any, templateDir: string, array: ModuleData[] ): Promise<ErrorsAnd<CatalogData>> {
  if ( array.length === 0 ) throw new Error ( `The array is empty` )
  const md = array[ array.length - 1 ]
  if ( hasErrors ( md ) ) return md
  if ( isCatalogData ( md ) ) return md
  if ( !isModuleDependency ( md ) ) throw new Error ( `The last element in the array is of unknown type, ${JSON.stringify ( md )}` )
  const dic = makeDictionary ( defaults, array )
  const value = await applyCatalogTemplateForKind ( fileOps, templateDir, md, dic )
  if ( hasErrors ( value ) ) return value
  return { ...md, catalogData: true, value }
}

export const isFile = ( fts: FileType[] ) => ( file: string ): boolean => {
  for ( const ft of fts )
    if ( ft.match ( file ) ) return true
  return false
};

export type FileAndFileType = {
  file: string
  ft: FileType
}
export async function findFilesAndFileType ( fileOps: FileOps, dir: string, fts: FileType[] ): Promise<FileAndFileType[]> {
  const files = await listFilesRecursively ( fileOps, dir, isFile ( fts ) )
  return files.map ( file => {
    const ft = fts.find ( ft => ft.match ( path.basename ( file ) ) );
    return ({ file: path.relative ( dir, file ).replace ( /\\/g, '/' ), ft });
  } );
}

export async function loadFiles ( fileOps: FileOps, dir: string, fts: FileAndFileType[], debug?: boolean ): Promise<ModuleData[]> {
  return await Promise.all (
    fts.map ( async ( { file, ft } ) =>
      await ft.load ( fileOps, file, path.join ( dir, file ), debug ) ) )
}

export type FileResults = {
  mds: ModuleData[]
  pathToMd: NameAnd<ModuleData>,
  entityToMd: NameAnd<ModuleData>
}
export function mdsToFileResults ( moduleData: ModuleData[] ): FileResults {
  const localEntities = moduleData.filter ( md => !hasErrors ( md ) && isModuleDependency ( md ) ).map ( md => (md as ModuleDependency).fullname )
  const mds = moduleData.map ( md => {
    if ( hasErrors ( md ) ) return md
    if ( isCatalogData ( md ) ) return md
    return ({ ...md, deps: md.deps.filter ( d => localEntities.includes ( d.fullname ) ) });
  } )
  const pathToMd: NameAnd<ModuleData> = {}
  const entityToMd: NameAnd<ModuleData> = {}
  for ( const md of mds ) {
    if ( hasErrors ( md ) ) continue
    pathToMd[ md.pathOffset ] = md
    if ( isModuleDependency ( md ) ) entityToMd[ md.fullname ] = md
  }
  return { mds, pathToMd, entityToMd }
}


export function filterFileTypes ( all: FileType[], fileTypes: string[] ): FileType[] {
  if ( fileTypes.length === 0 ) return all
  const errors = fileTypes.filter ( ft => !all.find ( a => a.sourceType === ft ) )
  if ( errors.length ) throw new Error ( `Unknown file types: ${errors.join ( ', ' )}` )
  const result = all.filter ( ft => fileTypes.includes ( ft.sourceType ) )
  return result
}

export function fileTypeFrom ( fts: FileType[], sourceType: string ): FileType {
  const ft = fts.find ( ft => ft.sourceType === sourceType )
  if ( !ft ) throw new Error ( `Unknown file type: ${sourceType}` )
  return ft
}

export function fileTypeFromMd ( fts: FileType[], md: ModuleData ): FileType | undefined {
  if ( hasErrors ( md ) ) return undefined
  const ft = fts.find ( ft => ft.sourceType === md.sourceType )
  if ( !ft ) throw new Error ( `Unknown file type: ${md.sourceType}` )
  return ft
}
export async function processOne ( fileOps: FileOps, defaults: any, templateDir: string, fts: FileType[], fileResults: FileResults, md: ModuleData ): Promise<ErrorsAnd<CatalogData>> {
  if ( hasErrors ( md ) ) return md
  if ( isCatalogData ( md ) ) return md
  const ft = fileTypeFromMd ( fts, md );
  if ( !ft ) throw new Error ( `Unknown file type: ${md.sourceType}` )
  const array = ft.makeArray ( fileResults.pathToMd, fileResults.entityToMd ) ( md );
  return ft.makeCatalog ( fileOps, defaults, templateDir, array );
}
export async function processFileResults ( fileOps: FileOps, defaults: any, templateDir: string, fts: FileType[], fileResults: FileResults ): Promise<ErrorsAnd<CatalogData>[]> {
  return await Promise.all ( fileResults.mds.map ( async md =>
    processOne ( fileOps, defaults, templateDir, fts, fileResults, md ) ) )
}

