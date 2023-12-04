import { Command } from "commander";
import { FileOps } from "@laoban/fileops";
import { ModuleDependency } from "./pom";
import { derefence } from "@laoban/variables";
import { doubleXmlVariableDefn } from "@laoban/variables/dist/src/variables";


export interface CommandContext {
  command: Command
  fileOps: FileOps
  currentDirectory: string
}


export interface RootCatalogTemplateDir {
  name: string
  targets: string
}
export function rootCatalogTemplateDictionary ( name: string, mds: ModuleDependency[], otherLocations: string[] ): RootCatalogTemplateDir {
  const fromPom = mds.map ( md => `   -  ./${md.module}/catalog-info.yaml` );
  const fromOther = otherLocations.map ( loc => `   -  ${loc}` )
  const targets = fromPom.concat ( fromOther ).join ( '\n' )
  return { name, targets }
}
export async function applyRootCatalogTemplate ( fileOps: FileOps, dir: string, dic: RootCatalogTemplateDir ): Promise<string> {
  const url = dir + "/root.template.yaml";
  const template = await fileOps.loadFileOrUrl ( url )
  return derefence ( `RootCatalog`, dic, template, { variableDefn: doubleXmlVariableDefn } )
}

// export const templateDir: string = 'src/template'
export const templateDir: string = 'https://raw.githubusercontent.com/run-book/backstage/master/modules/cli/src/template'
export interface CatalogTemplateDictionary {
  groupId: string
  artifactId: string
  description: string
  kind: string
  repository: string
  owner: string
  lifecycle: string
  dependsOn: string
}
export function catalogTemplateDic ( owner: string, md: ModuleDependency, repository: string, lifecycle: string ): CatalogTemplateDictionary {
  const dependsOn = md.deps.length === 0 ? '' : 'dependsOn: \n' + md.deps.map ( a => `   -  component:${a.groupId}.${a.artifactId}` ).join ( '\n' )
  return {
    ...md.properties,
    groupId: md.groupId,
    artifactId: md.artifactId,
    description: md.description ?? "Not provided in the POM",
    repository,
    lifecycle,
    owner,
    kind: md.kind,
    dependsOn
  }
}


async function loadTemplateForKind ( fileOps: FileOps, dir: string, kind: string ) {
  try {
    return await fileOps.loadFileOrUrl ( `${dir}/${kind}.template.yaml` );
  } catch ( err ) {
    return await fileOps.loadFileOrUrl ( `${dir}/default.template.yaml` );
  }
}
export async function applyCatalogTemplateForKind ( fileOps: FileOps, dir: string, kind: string, dic: CatalogTemplateDictionary ): Promise<string> {
  const template = await loadTemplateForKind ( fileOps, dir, kind )
  return derefence ( `Making template for ${dic.groupId}.${dic.artifactId}`, dic, template, { variableDefn: doubleXmlVariableDefn } )
}
