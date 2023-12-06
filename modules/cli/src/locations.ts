import { allChildrenUnder, makeTreeFromPathFnAndArray, Tree } from "./tree";
import { CatalogData, isModuleDependency, ModuleData, moduleDataPath, ModuleDataWithoutErrors } from "./module";
import { ErrorsAnd, hasErrors, mapErrors } from "@laoban/utils";
import { derefence } from "@laoban/variables";
import { doubleXmlVariableDefn } from "@laoban/variables/dist/src/variables";
import { FileOps } from "@laoban/fileops";
import path from "path";

export interface LocationFileData {
  path: string
  name: string
  children: string[]
}

function findLocationFileData ( roots: Tree<ModuleDataWithoutErrors>[], defaultName: string | undefined, all: boolean ): ErrorsAnd<LocationFileData>[] {
  // console.log ( 'findLocationFileData', roots )
  const result: ErrorsAnd<LocationFileData>[] = roots.map ( root => {
    let name = isModuleDependency ( root.value ) ? root.value.fullname : undefined
    if ( name === undefined && defaultName === undefined ) return [ `No name for ${root.value.pathOffset}` ]
    if ( name === undefined ) name = defaultName + '/' + root.value.pathOffset
    return ({
      path: path.dirname ( root.value.pathOffset ) + '/catalog-info.yaml',
      name,
      children: allChildrenUnder ( root ).filter ( r => all || !r.value.ignore ).map ( child => child.value.catalogName )
    })
  } )
  const existingRoot = roots.find ( md => moduleDataPath ( md.value ) === '.' ) !== undefined
  if ( !existingRoot ) {
    if ( defaultName === undefined ) result.push ( [ `No name for root` ] )
    else
      result.push ( { path: 'catalog-info.yaml', name: defaultName, children: roots.map ( root => root.value.pathOffset ) } )
  }
  return result;
}

export function findRoots ( mds: ModuleData[], all: boolean ): Tree<ModuleDataWithoutErrors>[] {
  const filtered = mds.filter ( md => !hasErrors ( md ) ) as ModuleDataWithoutErrors[]
  const tree = makeTreeFromPathFnAndArray<ModuleDataWithoutErrors> ( moduleDataPath, filtered )
  const roots = Object.values ( tree ).filter ( t => t.parent === undefined && !hasErrors ( t.value ) ) as Tree<ModuleDataWithoutErrors>[]
  return roots;
}

export function makeLocationFiles ( mds: ModuleData[], template: string, name: string | undefined, all: boolean ): ErrorsAnd<CatalogData>[] {
  const roots = findRoots ( mds, all )
  const lfds = findLocationFileData ( roots, name, all )
  const result: ErrorsAnd<CatalogData>[] = lfds.map ( lfd => mapErrors ( lfd, ( { name, path, children } ) => {
    const dic = {
      name,
      targets: children.map ( child => {
        const childPath = child.startsWith ( '.' ) ? child : `./${child}`;
        return `    - ${childPath}`;
      } ).join ( '\n' )
    }
    return ({
      catalogData: true,
      sourceType: 'catalogdata',
      pathOffset: path,
      catalogName: path,
      ignore: false,
      value: derefence ( `Location file for ${path}`, dic, template, { variableDefn: doubleXmlVariableDefn } )
    });
  } ) );
  return result;
}

export async function loadTemplateAndMakeLocationFiles ( fileOps: FileOps, templateDir, mds: ModuleData[], name: string | undefined, all: boolean ): Promise<ErrorsAnd<CatalogData> []> {
  const template = await fileOps.loadFileOrUrl ( templateDir + '/root.template.yaml' )
  return makeLocationFiles ( mds, template, name, all )
}
