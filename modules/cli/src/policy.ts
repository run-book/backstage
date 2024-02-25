import { SourceType } from "./module";
import { derefence } from "@laoban/variables";
import { FileOps, parseJson } from "@laoban/fileops";
import { doubleXmlVariableDefn } from "@laoban/variables";

export interface Policy {
  name: string,
  description: string,
  version: string,
  /** Default is <<path>>/catalog-info.<<sourceType>>.yaml */
  catalogInfoPattern: string

}
export const defaultPolicy: Policy = {
  name: 'default',
  description: 'Default policy',
  version: '0.0.1',
  catalogInfoPattern: '<<path>>/catalog-info.<<sourceType>>.yaml'
}

export async function loadPolicy ( fileOps: FileOps, policyUrl: string | undefined ): Promise<Policy> {
  if ( policyUrl === undefined ) return defaultPolicy
  return await parseJson<Policy> ( `Loading policy from ${policyUrl}` ) ( policyUrl );
}
export function catalogInfoFilename ( policy: Policy, sourceType: SourceType, path: string ): string {
  return derefence ( `catalogInfoFileName for ${path}`, { path, sourceType }, policy.catalogInfoPattern , {variableDefn: doubleXmlVariableDefn})
}