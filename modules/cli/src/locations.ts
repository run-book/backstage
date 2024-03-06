import { allChildrenUnder, makeTreeFromPathFnAndArray, Tree } from "./tree";
import { CatalogData, isExistingGenerated, isModuleDependency, isNotExistingGenerated, ModuleData, moduleDataPath, ModuleDataWithoutErrors } from "./module";
import { ErrorsAnd, hasErrors, mapErrors } from "@laoban/utils";
import { derefence } from "@laoban/variables";
import { doubleXmlVariableDefn } from "@laoban/variables";
import { FileOps } from "@laoban/fileops";
import path from "path";
import { cleanString } from "./strings";

export interface LocationFileData {
  path: string
  name: string
  children: string[]
}

export function prefixWithDotIfNeeded ( value: string ) {
  return value.startsWith ( '.' ) ? value : './' + value
}
function findLocationFileData ( roots: Tree<ModuleDataWithoutErrors>[], defaultName: string | undefined, all: boolean ): ErrorsAnd<LocationFileData>[] {
  const result: ErrorsAnd<LocationFileData>[] = roots.map ( root => {
    let name = isModuleDependency ( root.value ) ? root.value.fullname : undefined
    if ( name === undefined && defaultName === undefined ) return [ `No name for ${root.value.catalogName}  ${root.value.pathOffset} ` ]
    if ( name === undefined ) name = defaultName + '/' + root.value.pathOffset
    return ({
      path: path.dirname ( root.value.pathOffset ) + '/catalog-info.yaml',
      name,
      children: allChildrenUnder ( root ).filter ( r => all || !r.value.ignore ).map ( child => prefixWithDotIfNeeded ( child.value.catalogName ) )
    })
  } )
  const existingRootIndex = roots.findIndex ( md => moduleDataPath ( md.value ) === '.' )
  const existingRoot = roots[ existingRootIndex ]
  const validExistingRoot = existingRoot && !hasErrors ( existingRoot.value ) && isNotExistingGenerated ( existingRoot.value )
  // console.log('findLocationFileData', { existingRootIndex, existingRoot, validExistingRoot, defaultName, roots })
  if ( !validExistingRoot ) {
    if ( existingRootIndex !== -1 ) result.splice ( existingRootIndex, 1 )
    if ( defaultName === undefined ) result.push ( [ `No name for root` ] )
    else {
      const newRoot = {
        path: './catalog-info.yaml', name: defaultName,
        children: roots.map ( root => prefixWithDotIfNeeded ( path.dirname ( root.value.catalogName ) + '/catalog-info-yaml' ) )
      };
      result.push ( newRoot )
    }
  }
  return result;
}

export function findRoots ( mds: ModuleData[], all: boolean ): Tree<ModuleDataWithoutErrors>[] {
  const filtered = mds.filter ( md => !hasErrors ( md ) ).filter ( isNotExistingGenerated ) as ModuleDataWithoutErrors[]
  const tree = makeTreeFromPathFnAndArray<ModuleDataWithoutErrors> ( moduleDataPath, filtered )
  const roots = Object.values ( tree ).filter ( t => t.parent === undefined && !hasErrors ( t.value ) ) as Tree<ModuleDataWithoutErrors>[]
  return roots;
}

export function makeLocationFiles ( mds: ModuleData[], template: string, name: string | undefined, all: boolean ): ErrorsAnd<CatalogData>[] {
  const roots = findRoots ( mds, all )
  const lfds = findLocationFileData ( roots, name, all )
  const result: ErrorsAnd<CatalogData>[] = lfds.map ( lfd => mapErrors ( lfd, ( { name, path, children } ) => {
    const dic = {
      name: cleanString ( name ),
      targets: children.map ( child => `    - ${child}` ).join ( '\n' )
    }
    return ({
      catalogData: true,
      sourceType: 'catalogdata',
      pathOffset: path,
      catalogName: path,
      existingGenerated: false,
      ignore: false,
      value: derefence ( `Location file for ${path}`, dic, template, { variableDefn: doubleXmlVariableDefn } )
    });
  } ) );
  // console.log('makeLocationFiles', result)
  return result;
}

export async function loadTemplateAndMakeLocationFiles ( fileOps: FileOps, templateDir, mds: ModuleData[], name: string | undefined, all: boolean ): Promise<ErrorsAnd<CatalogData> []> {
  const template = await fileOps.loadFileOrUrl ( templateDir + '/root.template.yaml' )
  return makeLocationFiles ( mds, template, name, all )
}
