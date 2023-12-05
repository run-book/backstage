import { FileType } from "./filetypes";
import { backstageYamlTC } from "./backstage.yaml.filetype";
import { catalogInfoYamlTC } from "./catalogInfo.fileType";
import { pomFiletype } from "./pom.filetype";
import { npmFiletype } from "./npm.filetype";

export const alLFileTypes: FileType[] = [
  backstageYamlTC, catalogInfoYamlTC, pomFiletype, npmFiletype
]

