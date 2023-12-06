import { FileOps } from "@laoban/fileops";
import { NameAnd } from "@laoban/utils";
import { CatalogData, ModuleData, ModuleDependency } from "../module";
import { defaultMakeCatalogFromArray, ModuleDependencyFileType, FileType, defaultMakeCatalogFromCD, SimpleFileType } from "./filetypes";
import { Policy } from "../policy";

const matchBackstage = /^.*backstage\.([^.]+)\.yaml$/;

export const backstageYamlTC: SimpleFileType = {
  sourceType: 'backstageyaml',
  match: ( filename: string ) => matchBackstage.test ( filename ),
  load: async ( fileOps: FileOps, policy: Policy, pathOffset: string, filename: string, debug?: boolean ): Promise<CatalogData> => {
    const value = await fileOps.loadFileOrUrl ( filename );
    return { catalogData: true, sourceType: 'backstageyaml', catalogName: pathOffset, pathOffset, value, ignore: false, existingGenerated: false }
  },
  makeCatalogFromMd: defaultMakeCatalogFromCD
}