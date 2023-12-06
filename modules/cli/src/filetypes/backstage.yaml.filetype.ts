import { FileOps } from "@laoban/fileops";
import { NameAnd } from "@laoban/utils";
import { ModuleData } from "../module";
import { defaultMakeCatalogFromArray, ModuleDependencyFileType, FileType, defaultMakeCatalogFromCD, SimpleFileType } from "./filetypes";

const matchBackstage = /^.*backstage\.([^.]+)\.yaml$/;

export const backstageYamlTC: SimpleFileType = {
  sourceType: 'backstageyaml',
  match: ( filename: string ) => matchBackstage.test ( filename ),
  load: async ( fileOps: FileOps, pathOffset: string, filename: string, debug?: boolean ) => {
    const value = await fileOps.loadFileOrUrl ( filename );
    return { catalogData: true, sourceType: 'backstageyaml', catalogName: pathOffset, pathOffset, value, ignore: false }
  },
  makeCatalogFromMd: defaultMakeCatalogFromCD
}