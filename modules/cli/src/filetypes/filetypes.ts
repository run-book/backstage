import { CatalogData, isCatalogData, isModuleDependency, ModuleData, ModuleDependency, SourceType } from "../module";
import { ErrorsAnd, flatMapK, hasErrors, mapK } from "@laoban/utils";
import { FileOps } from "@laoban/fileops";
import { applyCatalogTemplateForKind } from "../templates";
import { listFilesRecursively } from "../file.search";
import path from "path";
import { Policy } from "../policy";

export interface CommonFileType {
  sourceType: SourceType
  //Does a filename match the requirements. Could be pom.xml. Could be backstage.xxx.yaml. Could be catalog-info.yaml... etc
  match: ( filename: string ) => boolean
  //Give a file and the parsed content what is the kind.
  load: ( fileOps: FileOps, policy: Policy, pathOffset: string, filename: string, debug?: boolean ) => Promise<ModuleData>
}
export interface SimpleFileType extends CommonFileType {
  makeCatalogFromMd: ( md: ModuleData ) => Promise<ErrorsAnd<CatalogData>>
}
export function isSimpleFileType ( ft: FileType ): ft is SimpleFileType {
  return (ft as SimpleFileType).makeCatalogFromMd !== undefined
}

//This is for filetypes that work on module dependencies such as pom.xml and package.json. Importantly they have parents... and thus we need the arrays
//pom.xml and package.json need different data structures (ArrayHelper) to work out who is their parent
export interface ModuleDependencyFileType<ArrayHelper> extends CommonFileType {
  makeArrayHelper: ( mds: ModuleDependency[] ) => ArrayHelper
  //Given a module this will find the parents and place into an array with the md at the end
  makeArray: ( arrayHelper: ArrayHelper ) => ( md: ModuleDependency ) => ModuleDependency[]
  makeCatalogFromArray: ( fileOps: FileOps, defaults: any, templateDir: string, array: ModuleDependency[] ) => Promise<ErrorsAnd<CatalogData>>
}
export function isModuleDependencyFileType ( ft: FileType ): ft is ModuleDependencyFileType<any> {
  return (ft as ModuleDependencyFileType<any>).makeCatalogFromArray !== undefined
}
export type FileType = SimpleFileType | ModuleDependencyFileType<any>

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

export async function defaultMakeCatalogFromCD ( md: ModuleData ): Promise<ErrorsAnd<CatalogData>> {
  if ( hasErrors ( md ) ) return md
  if ( isCatalogData ( md ) ) return md
  throw new Error ( `The md is not a catalog data: ${md}` )
}
export async function defaultMakeCatalogFromArray ( fileOps: FileOps, defaults: any, templateDir: string, array: ModuleData[] ): Promise<ErrorsAnd<CatalogData>> {
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

export async function loadFiles ( fileOps: FileOps, policy: Policy, dir: string, fts: FileAndFileType[], debug?: boolean ): Promise<ModuleData[]> {
  return await Promise.all (
    fts.map ( async ( { file, ft } ) =>
      await ft.load ( fileOps, policy, file, path.join ( dir, file ), debug ) ) )
}

export function withLocalDependencies ( mds: ModuleDependency[] ): ModuleDependency[] {
  const localEntities = mds.map ( md => (md as ModuleDependency).fullname )
  return mds.map ( md => ({ ...md, deps: md.deps.filter ( d => localEntities.includes ( d.fullname ) ) }) )
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

export function processAllForSimpleFT ( ft: SimpleFileType, mds: ModuleData[] ): Promise<ErrorsAnd<CatalogData>[]> {
  const mdsForFt = mds.filter ( md => !hasErrors ( md ) && md.sourceType === ft.sourceType )
  return mapK ( mdsForFt, (md => ft.makeCatalogFromMd ( md )) )
}
export async function processOne<ArrayHelper> ( fileOps: FileOps, defaults: any, templateDir: string, ft: ModuleDependencyFileType<ArrayHelper>, arrayHelper: ArrayHelper, md: ModuleDependency ): Promise<ErrorsAnd<CatalogData>> {
  const array = ft.makeArray ( arrayHelper ) ( md );
  return ft.makeCatalogFromArray ( fileOps, defaults, templateDir, array );
}
export function justModuleDependenciesForFtWithLocalDeps<ArrayHelper> ( mds: ModuleData[], ft: ModuleDependencyFileType<ArrayHelper> ) {
  const mdsForFt = mds.filter ( md => !hasErrors ( md ) && md.sourceType === ft.sourceType ) as ModuleDependency[]
  const withLocalDeps = withLocalDependencies ( mdsForFt )
  return withLocalDeps;
}
export function processAllForModuleDependencyFt<ArrayHelper> ( fileOps: FileOps, defaults: any, templateDir: string, ft: ModuleDependencyFileType<ArrayHelper>, mds: ModuleData[] ): Promise<ErrorsAnd<CatalogData>[]> {
  const withLocalDeps = justModuleDependenciesForFtWithLocalDeps ( mds, ft );
  const arrayHelper = ft.makeArrayHelper ( withLocalDeps )
  return mapK ( withLocalDeps, md => processOne ( fileOps, defaults, templateDir, ft, arrayHelper, md ) )
}
export function processForFileType ( fileOps: FileOps, defaults: any, templateDir: string, mds: ModuleData[], ft: FileType ): Promise<ErrorsAnd<CatalogData>[]> {
  if ( isSimpleFileType ( ft ) ) return processAllForSimpleFT ( ft, mds )
  if ( isModuleDependencyFileType ( ft ) ) return processAllForModuleDependencyFt ( fileOps, defaults, templateDir, ft, mds )
  throw new Error ( `Unknown file type ${ft}` )
}
export async function processFileResults ( fileOps: FileOps, defaults: any, templateDir: string, fts: FileType[], mds: ModuleData[] ): Promise<ErrorsAnd<CatalogData>[]> {
  const removeIgnored = mds.filter ( md => !hasErrors ( md ) && !md.ignore )
  const processed = await flatMapK ( fts, async ft => processForFileType ( fileOps, defaults, templateDir, removeIgnored, ft ) );
  const existingErrors = mds.filter ( hasErrors )
  return [ ...processed, ...existingErrors ]
}

