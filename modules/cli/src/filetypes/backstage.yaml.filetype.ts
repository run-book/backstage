import { FileOps } from "@laoban/fileops";
import { NameAnd } from "@laoban/utils";
import { ModuleData } from "../module";
import { defaultMakeCatalog, FileType } from "./filetypes";

const matchBackstage = /^.*backstage\.([^.]+)\.yaml$/;

export const backstageYamlTC: FileType = {
  sourceType: 'backstageyaml',
  match: ( filename: string ) => matchBackstage.test ( filename ),
  load: async ( fileOps: FileOps, pathOffset: string, filename: string, debug?: boolean ) => {
    const value = await fileOps.loadFileOrUrl ( filename );
    return { catalogData: true, sourceType: 'backstageyaml', catalogName: pathOffset, pathOffset, value, ignore: false }
  },
  makeArray: ( pathToMd: NameAnd<ModuleData>, entityToMd: NameAnd<ModuleData> ) => ( md: ModuleData ) => [ md ],
  makeCatalog: defaultMakeCatalog
}